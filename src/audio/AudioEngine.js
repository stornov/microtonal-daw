import * as Tone from 'tone';
import { getFrequency } from '../utils/mathUtils';
import { useAppStore } from '../store/useAppStore';

class AudioEngine {
  constructor() {
    this.synths = {}; 
    this.trackGains = {};  
    this.instFX = {};      
    
    this.analyser = new Tone.Analyser('waveform', 1024);
    this.masterGain = new Tone.Gain(0.5); 
    this.limiter = new Tone.Limiter(-1); 

    this.analyser.chain(this.masterGain, this.limiter, Tone.Destination);

    this.isInitialized = false;
    this.isInitializing = false; 
    this.tailTimeout = null;
    this.syncTimeout = null;
  }

  async init() {
    if (this.isInitialized || this.isInitializing) return;
    this.isInitializing = true;
    
    await Tone.start();
    this.recorder = new Tone.Recorder();
    this.masterGain.connect(this.recorder);

    this.syncInstruments(); 
    this.setupSubscriptions(); 
    
    this.isInitialized = true;
    this.isInitializing = false;
  }

  setupSubscriptions() {
    let prevVol = null;
    let prevBlocks = null;
    let prevTempo = null;
    let prevTracks = null;
    let prevInsts = null;

    useAppStore.subscribe((state) => {
      if (state.volume !== prevVol) {
        this.updateVolume(state.volume);
        prevVol = state.volume;
      }

      const needsSync = state.blocks !== prevBlocks || 
                        state.tempo !== prevTempo || 
                        state.tracks !== prevTracks || 
                        state.instruments !== prevInsts;
      
      if (needsSync) {
        prevBlocks = state.blocks;
        prevTempo = state.tempo;
        prevTracks = state.tracks;
        prevInsts = state.instruments;

        if (!state.isEditing && state.liveKeypresses.length === 0) {
          clearTimeout(this.syncTimeout);
          this.syncTimeout = setTimeout(() => {
            this.syncTimeline();
          }, 150);
        }
      }
    });
  }

  syncInstruments() {
    const { instruments, tracks, blocks, currentInstrumentId, activeBlockId } = useAppStore.getState();

    Object.keys(this.instFX).forEach(instId => {
      if (!instruments.find(i => i.id === instId)) {
        this.instFX[instId].delay.dispose();
        this.instFX[instId].reverb.dispose();
        this.instFX[instId].input.dispose();
        delete this.instFX[instId];
      }
    });

    Object.keys(this.synths).forEach(key => {
      const [tId, iId] = key.split('::');
      if (!tracks.find(t => t.id === tId) || !instruments.find(i => i.id === iId)) {
        this.synths[key].dispose();
        this.trackGains[key].dispose();
        delete this.synths[key];
        delete this.trackGains[key];
      }
    });

    instruments.forEach(inst => {
      if (!this.instFX[inst.id]) {
        const input = new Tone.Gain(1);
        const delay = new Tone.FeedbackDelay("8n", 0.4);
        const reverb = new Tone.Freeverb({ roomSize: 0.6, dampening: 2000 });
        
        input.chain(delay, reverb, this.analyser);
        this.instFX[inst.id] = { input, delay, reverb };
      }
      const fx = this.instFX[inst.id];
      fx.reverb.wet.value = inst.reverb ?? 0.2;
      fx.delay.wet.value = inst.delay ?? 0.1;
    });

    const ensureSynth = (tId, iId) => {
      const key = `${tId}::${iId}`;
      if (!this.synths[key]) {
        const inst = instruments.find(i => i.id === iId);
        const fxBus = this.instFX[iId];
        
        if (inst && fxBus) {
          const gainNode = new Tone.Gain(1);
          gainNode.connect(fxBus.input); 
          
          const synth = new Tone.PolySynth(Tone.Synth, { 
            volume: -10,
            maxPolyphony: 8 
          });
          synth.connect(gainNode);
          
          this.synths[key] = synth;
          this.trackGains[key] = gainNode;
        }
      }

      const synth = this.synths[key];
      const inst = instruments.find(i => i.id === iId);
      
      if (synth && inst) {
        const attackSec = inst.a_disabled ? 0.01 : inst.attack / 1000;
        const decaySec = inst.d_disabled ? 0.1 : inst.decay / 1000;
        const sustainVal = inst.s_disabled ? 1.0 : inst.sustain / 127;
        const releaseSec = inst.r_disabled ? 0.1 : inst.release / 1000;

        synth.set({
          oscillator: { type: inst.waveType },
          envelope: { attack: attackSec, decay: decaySec, sustain: sustainVal, release: releaseSec }
        });
      }
    };

    blocks.forEach(b => {
      if (b.trackId && b.instrumentId) ensureSynth(b.trackId, b.instrumentId);
    });

    const activeBlock = blocks.find(b => b.id === activeBlockId);
    const liveTrackId = activeBlock ? activeBlock.trackId : (tracks[0]?.id || 'track_1');
    ensureSynth(liveTrackId, currentInstrumentId);

    this.updateMixer();
  }

  updateTrackVolumeNode(trackId, tracksList) {
    const track = tracksList.find(t => t.id === trackId);
    const hasSolo = tracksList.some(t => t.isSolo);
    const isAllowed = track && !(track.isMuted ?? false) && (!hasSolo || (track.isSolo ?? false));
    const targetGain = isAllowed ? (track.volume ?? 1.0) : 0;

    Object.keys(this.trackGains).forEach(key => {
      if (key.startsWith(`${trackId}::`)) {
        this.trackGains[key].gain.rampTo(targetGain, 0.05);
      }
    });
  }

  updateMixer() {
    const { tracks } = useAppStore.getState();
    tracks.forEach(track => this.updateTrackVolumeNode(track.id, tracks));
  }

  updateVolume(val) {
    if (this.masterGain) {
      this.masterGain.gain.rampTo(val <= 0.01 ? 0 : val, 0.05);
    }
  }

  playNote(noteIndex) {
    this.init();
    this.syncInstruments();

    const { edo, currentInstrumentId, activeBlockId, blocks } = useAppStore.getState();
    const activeBlock = blocks.find(b => b.id === activeBlockId);
    const trackId = activeBlock ? activeBlock.trackId : 'track_1';
    const key = `${trackId}::${currentInstrumentId}`;
    
    const synth = this.synths[key];
    if (!synth) return;

    const blockBaseFreq = activeBlock ? activeBlock.baseFreq : 261.63;
    synth.triggerAttack(getFrequency(noteIndex, edo, blockBaseFreq));
  }

  stopNote(noteIndex) {
    this.syncInstruments();

    const { edo, currentInstrumentId, activeBlockId, blocks } = useAppStore.getState();
    const activeBlock = blocks.find(b => b.id === activeBlockId);
    const trackId = activeBlock ? activeBlock.trackId : 'track_1';
    const key = `${trackId}::${currentInstrumentId}`;

    const synth = this.synths[key];
    if (!synth) return;

    const blockBaseFreq = activeBlock ? activeBlock.baseFreq : 261.63;
    synth.triggerRelease(getFrequency(noteIndex, edo, blockBaseFreq));
  }

  stopAll() {
    Object.values(this.synths).forEach(synth => synth.releaseAll());
  }

  stopAllImmediate() {
    if (this.tailTimeout) {
      clearTimeout(this.tailTimeout); 
      this.tailTimeout = null;
    }
    Tone.Transport.stop(); 
    Tone.Transport.cancel(0); 
    this.stopAll();

    const state = useAppStore.getState();
    state.setIsPlaying(false);
    state.clearLiveActiveNotes();
    state.setLiveKeypresses([]);
  }

  getWaveformData() {
    return this.analyser.getValue();
  }

  async syncTimeline() {
    if (!this.isInitialized) return;
    
    this.syncInstruments();

    if (Tone.Transport.state === 'started') {
      this.stopAll();
      useAppStore.getState().clearLiveActiveNotes();
    }

    const currentTicks = Tone.Transport.ticks;
    Tone.Transport.cancel(0);

    const state = useAppStore.getState();
    const ppq = Tone.Transport.PPQ;
    Tone.Transport.bpm.value = state.tempo;

    let loopStartBeat = 0;
    let loopEndBeat = 4.0;

    state.blocks.forEach(b => {
      const end = b.startBeat + b.durationBeats;
      if (end > loopEndBeat) loopEndBeat = end;
    });

    const tracks = useAppStore.getState().tracks;
    const hasSolo = tracks.some(t => t.isSolo);

    state.blocks.forEach((block) => {
      const startTicks = block.startBeat * ppq;
      const durationTicks = block.durationBeats * ppq;
      const endTicks = startTicks + durationTicks;

      const track = tracks.find(t => t.id === block.trackId);
      const isAllowed = track && !(track.isMuted ?? false) && (!hasSolo || (track.isSolo ?? false));
      
      const currentInst = useAppStore.getState().instruments.find(i => i.id === block.instrumentId);
      const instColor = currentInst?.color || '#fff'; 
      const key = `${block.trackId}::${block.instrumentId}`;

      Tone.Transport.schedule((time) => {
        const currentEdo = useAppStore.getState().edo;
        const blockBaseFreq = block.baseFreq || 261.63; 
        const synth = this.synths[key]; 

        if (synth && block.notes.length > 0 && isAllowed) {
          const freqs = block.notes.map(n => getFrequency(n, currentEdo, blockBaseFreq));
          const durSec = block.durationBeats * (60 / useAppStore.getState().tempo);
          const vel = ((block.velocity !== undefined ? block.velocity : 100) / 127);

          synth.triggerAttackRelease(freqs, durSec, time, vel);
        }

        if (isAllowed) {
          Tone.Draw.schedule(() => {
            useAppStore.getState().addLiveActiveNote(block.id, block.notes, instColor);
          }, time);
        }

      }, `${startTicks}i`);

      const safeEndTicks = Math.max(startTicks, endTicks - 1);
      
      Tone.Transport.schedule((time) => {
        Tone.Draw.schedule(() => {
          useAppStore.getState().removeLiveActiveNote(block.id);
        }, time);
      }, `${safeEndTicks}i`);
    });

    Tone.Transport.loop = true;
    Tone.Transport.loopStart = `${loopStartBeat * ppq}i`;
    Tone.Transport.loopEnd = `${loopEndBeat * ppq}i`;

    Tone.Transport.ticks = currentTicks;
  }

  async startSequencer() {
    await this.init();
    
    this.syncInstruments();
    this.updateVolume(useAppStore.getState().volume); 

    await this.syncTimeline(); 

    const state = useAppStore.getState();
    const ppq = Tone.Transport.PPQ || 192;
    const currentBeat = Tone.Transport.ticks / ppq; 
    const tracks = state.tracks;
    const hasSolo = tracks.some(t => t.isSolo);

    state.blocks.forEach((block) => {
      const endBeat = block.startBeat + block.durationBeats;
      const track = tracks.find(t => t.id === block.trackId);
      const isAllowed = track && !(track.isMuted ?? false) && (!hasSolo || (track.isSolo ?? false));
      const currentInst = state.instruments.find(i => i.id === block.instrumentId);
      const instColor = currentInst?.color || '#fff'; 
      const key = `${block.trackId}::${block.instrumentId}`;

      if (currentBeat > block.startBeat && currentBeat < endBeat && isAllowed) {
        const currentEdo = state.edo;
        const blockBaseFreq = block.baseFreq || 261.63;
        const synth = this.synths[key];

        if (synth && block.notes.length > 0) {
          const freqs = block.notes.map(n => getFrequency(n, currentEdo, blockBaseFreq));
          const remainingBeats = endBeat - currentBeat;
          const remainingSeconds = remainingBeats * (60 / state.tempo);
          const vel = ((block.velocity !== undefined ? block.velocity : 100) / 127);

          synth.triggerAttackRelease(freqs, remainingSeconds, Tone.now(), vel);
          state.addLiveActiveNote(block.id, block.notes, instColor);
        }
      }
    });

    Tone.Transport.start();
    useAppStore.getState().setIsPlaying(true);
  }

  stopSequencer() {
    Tone.Transport.pause(); 
    this.stopAll();
    
    const state = useAppStore.getState();
    state.setIsPlaying(false);
    state.setLiveKeypresses([]);
    state.clearLiveActiveNotes();
  }

  async startRecording() {
    await this.init();
    Tone.Transport.ticks = 0; 
    
    this.recorder.start(); 
    await this.startSequencer(); 
    
    Tone.Transport.loop = false; 
    useAppStore.getState().setIsRecording(true);
  }

  async stopRecordingWithTail() {
    Tone.Transport.pause(); 
    this.stopAll(); 
    
    const state = useAppStore.getState();
    state.setIsPlaying(false); 

    this.tailTimeout = setTimeout(async () => {
      if (!state.isRecording) return; 

      const audioBlob = await this.recorder.stop(); 
      state.setIsRecording(false);
      state.clearLiveActiveNotes();

      const url = URL.createObjectURL(audioBlob);
      const anchor = document.createElement("a");
      anchor.download = "microtonal_master_track.wav"; 
      anchor.href = url;
      anchor.click();
      URL.revokeObjectURL(url);
      
      this.tailTimeout = null;
    }, 3500); 
  }
}

export const engine = new AudioEngine();