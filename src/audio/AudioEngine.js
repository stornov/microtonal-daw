import * as Tone from 'tone';
import { getFrequency, SUBDIVISIONS } from '../utils/mathUtils';
import { useAppStore } from '../store/useAppStore';

class AudioEngine {
  constructor() {
    this.synths = {};
    this.effects = {}; 
    
    this.analyser = new Tone.Analyser('waveform', 1024);
    this.volumeNode = new Tone.Volume(0);
    this.limiter = new Tone.Limiter(-1); 

    this.analyser.connect(this.volumeNode);
    this.volumeNode.connect(this.limiter);
    this.limiter.toDestination();

    this.isInitialized = false;
    this.isInitializing = false; 
  }

  async init() {
    if (this.isInitialized || this.isInitializing) return;
    this.isInitializing = true;
    
    await Tone.start();
    await this.syncInstruments();
    
    this.isInitialized = true;
    this.isInitializing = false;
  }

  async syncInstruments() {
    const { instruments } = useAppStore.getState();
    for (const inst of instruments) {
      if (!this.synths[inst.id]) {
        const reverb = new Tone.Freeverb({ roomSize: 0.6, dampening: 2000 });
        const delay = new Tone.FeedbackDelay("8n", 0.4);
        const synth = new Tone.PolySynth(Tone.Synth, { volume: -15 });
        
        synth.chain(delay, reverb, this.analyser);
        
        this.synths[inst.id] = synth;
        this.effects[inst.id] = { reverb, delay };
      }
      
      const synth = this.synths[inst.id];
      const fx = this.effects[inst.id];
      
      const attackSec = inst.a_disabled ? 0.01 : inst.attack / 1000;
      const decaySec = inst.d_disabled ? 0.1 : inst.decay / 1000;
      const sustainVal = inst.s_disabled ? 1.0 : inst.sustain / 127;
      const releaseSec = inst.r_disabled ? 0.1 : inst.release / 1000;

      synth.set({
        oscillator: { type: inst.waveType },
        envelope: { attack: attackSec, decay: decaySec, sustain: sustainVal, release: releaseSec }
      });

      if (fx) {
        fx.reverb.wet.value = inst.reverb ?? 0.2;
        fx.delay.wet.value = inst.delay ?? 0.1;
      }
    }
  }

  playNote(noteIndex) {
    this.init();
    
    if (this.volumeNode && this.volumeNode.mute) {
      this.volumeNode.mute = false;
      this.updateVolume(useAppStore.getState().volume);
    }

    const { edo, currentInstrumentId, activeBlockId, blocks } = useAppStore.getState();
    const synth = this.synths[currentInstrumentId];
    if (!synth) return;

    const activeBlock = blocks.find(b => b.id === activeBlockId);
    const blockBaseFreq = activeBlock ? activeBlock.baseFreq : 261.63;

    synth.triggerAttack(getFrequency(noteIndex, edo, blockBaseFreq));
  }

  stopNote(noteIndex) {
    const { edo, currentInstrumentId, activeBlockId, blocks } = useAppStore.getState();
    const synth = this.synths[currentInstrumentId];
    if (!synth) return;

    const activeBlock = blocks.find(b => b.id === activeBlockId);
    const blockBaseFreq = activeBlock ? activeBlock.baseFreq : 261.63;

    synth.triggerRelease(getFrequency(noteIndex, edo, blockBaseFreq));
  }

  stopAll() {
    Object.values(this.synths).forEach(synth => synth.releaseAll());
  }

  stopAllImmediate() {
    Tone.Transport.stop(); 
    Tone.Transport.cancel(0); 
    
    Object.values(this.synths).forEach(synth => {
      synth.releaseAll();
    });

    if (this.volumeNode) {
      this.volumeNode.mute = true;
    }

    const state = useAppStore.getState();
    state.setIsPlaying(false);
    state.setCurrentPlayheadBeat(-1);
    state.setLiveActiveNotes({});
  }

  updateVolume(val) {
    if (val === 0) {
      this.volumeNode.mute = true;
    } else {
      this.volumeNode.mute = false;
      this.volumeNode.volume.value = Tone.gainToDb(val); 
    }
  }

  getWaveformData() {
    return this.analyser.getValue();
  }

  async syncTimeline() {
    if (!this.isInitialized) return;
    const currentTicks = Tone.Transport.ticks;
    Tone.Transport.cancel(0);

    const state = useAppStore.getState();
    const ppq = Tone.Transport.PPQ;
    Tone.Transport.bpm.value = state.tempo;

    let maxBeats = 4.0;
    state.blocks.forEach(b => {
      const end = b.startBeat + b.durationBeats;
      if (end > maxBeats) maxBeats = end;
    });

    state.blocks.forEach((block) => {
      const startTicks = block.startBeat * ppq;

      Tone.Transport.schedule((time) => {
        const currentEdo = useAppStore.getState().edo;
        const blockBaseFreq = block.baseFreq || 261.63; 
        const synth = this.synths[block.instrumentId]; 

        if (synth && block.notes.length > 0) {
          const freqs = block.notes.map(n => getFrequency(n, currentEdo, blockBaseFreq));
          const durSec = block.durationBeats * (60 / useAppStore.getState().tempo);
          const vel = (block.velocity !== undefined ? block.velocity : 100) / 127;
          synth.triggerAttackRelease(freqs, durSec, time, vel);
        }
      }, `${startTicks}i`);
    });

    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = `${maxBeats * ppq}i`;

    if (Tone.Transport.state === 'started') {
      Tone.Transport.ticks = currentTicks;
    }
  }

  async startSequencer() {
    await this.init();

    if (this.volumeNode) {
      this.volumeNode.mute = false;
      this.updateVolume(useAppStore.getState().volume);
    }

    await this.syncTimeline(); 

    const state = useAppStore.getState();
    const ppq = Tone.Transport.PPQ || 192;
    const currentBeat = Tone.Transport.ticks / ppq; 

    state.blocks.forEach((block) => {
      const endBeat = block.startBeat + block.durationBeats;
      
      if (currentBeat > block.startBeat && currentBeat < endBeat) {
        const currentEdo = state.edo;
        const blockBaseFreq = block.baseFreq || 261.63;
        const synth = this.synths[block.instrumentId];

        if (synth && block.notes.length > 0) {
          const freqs = block.notes.map(n => getFrequency(n, currentEdo, blockBaseFreq));
          const remainingBeats = endBeat - currentBeat;
          const remainingSeconds = remainingBeats * (60 / state.tempo);
          const vel = (block.velocity !== undefined ? block.velocity : 100) / 127;

          synth.triggerAttackRelease(freqs, remainingSeconds, Tone.now(), vel);
        }
      }
    });

    Tone.Transport.start();
    useAppStore.getState().setIsPlaying(true);
  }

  stopSequencer() {
    Tone.Transport.pause(); 
    this.stopAll();
    useAppStore.getState().setIsPlaying(false);
  }
}

export const engine = new AudioEngine();