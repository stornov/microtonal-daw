import * as Tone from 'tone';
import { getFrequency } from '../utils/mathUtils';
import { useAppStore } from '../store/useAppStore';

class AudioEngine {
  constructor() {
    this.synths = {};
    this.effects = {};
    this.analyser = null;
    this.volumeNode = null;
    this.limiter = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    await Tone.start();
    
    this.analyser = new Tone.Analyser('waveform', 1024);
    this.volumeNode = new Tone.Volume(0);
    this.limiter = new Tone.Limiter(-2); 
    
    this.analyser.connect(this.volumeNode);
    this.volumeNode.connect(this.limiter);
    this.limiter.toDestination();

    await this.syncInstruments();
    this.isInitialized = true;
  }

  async syncInstruments() {
    const { instruments } = useAppStore.getState();
    for (const inst of instruments) {
      if (!this.synths[inst.id]) {
        const reverb = new Tone.Reverb({ decay: 4, preDelay: 0.01 });
        await reverb.generate();
        const delay = new Tone.FeedbackDelay("8n", 0.4);
        const synth = new Tone.PolySynth(Tone.Synth, {
          volume: -12,
          oscillator: { type: 'sine' }
        });
        synth.chain(delay, reverb, this.analyser, this.volumeNode, this.limiter, Tone.Destination);
        this.synths[inst.id] = synth;
        this.effects[inst.id] = { reverb, delay };
      }
      
      const synth = this.synths[inst.id];
      const fx = this.effects[inst.id];
      synth.set({
        oscillator: { type: inst.waveType },
        envelope: { attack: inst.attack, decay: 0.3, sustain: 0.8, release: inst.release }
      });
      fx.reverb.wet.value = inst.reverb;
      fx.delay.wet.value = inst.delay;
    }
  }

  playNote(noteIndex) {
    if (!this.isInitialized) return;
    const { edo, baseFreq, currentInstrumentId } = useAppStore.getState();
    const synth = this.synths[currentInstrumentId];
    if (!synth) return;
    synth.triggerAttack(getFrequency(noteIndex, edo, baseFreq));
  }

  stopNote(noteIndex) {
    if (!this.isInitialized) return;
    const { edo, baseFreq, currentInstrumentId } = useAppStore.getState();
    const synth = this.synths[currentInstrumentId];
    if (!synth) return;
    synth.triggerRelease(getFrequency(noteIndex, edo, baseFreq));
  }

  stopAll() {
    Object.values(this.synths).forEach(synth => synth.releaseAll());
  }

  updateVolume(val) {
    if (!this.isInitialized) return;
    this.volumeNode.mute = (val === 0);
    if (val > 0) this.volumeNode.volume.value = Tone.gainToDb(val); 
  }

  getWaveformData() {
    if (!this.isInitialized || !this.analyser) return null;
    return this.analyser.getValue();
  }

  // --- ИГРАЕМ ЦЕПОЧКУ НАШИХ ГЕОМЕТРИЧЕСКИХ КАДРОВ ---
  async startSequencer() {
    await this.init();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.stopAll();

    const state = useAppStore.getState();
    Tone.Transport.bpm.value = state.tempo;

    let accumBeats = 0; // Накопленное время в долях

    state.snapshots.forEach((snap, index) => {
      const snapTime = `${accumBeats}:0:0`; // Время старта кадра в долях (bars:beats:sixteenths)
      const durationBeats = snap.duration;

      // Планируем проигрывание аккордов для каждого инструмента на этом шаге
      Tone.Transport.schedule((time) => {
        const currentEdo = useAppStore.getState().edo;
        const currentBaseFreq = useAppStore.getState().baseFreq;

        // Запускаем звук для каждого инструмента в кадре
        Object.entries(snap.layers).forEach(([instId, notes]) => {
          const synth = this.synths[instId];
          if (synth && notes.length > 0) {
            const freqs = notes.map(n => getFrequency(n, currentEdo, currentBaseFreq));
            // Играем аккорд. Длительность чуть-чуть урезаем, чтобы между кадрами был зазор (staccato эффект)
            synth.triggerAttackRelease(freqs, `${durationBeats}*4n - 0.1`, time);
          }
        });

        // Синхронизируем интерфейс: переключаем фокус на текущий играющий кадр
        Tone.Draw.schedule(() => {
          useAppStore.getState().setCurrentPlayingIndex(index);
          useAppStore.getState().setActiveSnapshotId(snap.id);
        }, time);

      }, snapTime);

      accumBeats += durationBeats;
    });

    // Настраиваем петлю (Loop) на общую длину всех кадров
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = `${accumBeats}:0:0`;

    Tone.Transport.start();
    useAppStore.getState().setIsPlaying(true);
  }

  stopSequencer() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.stopAll();
    useAppStore.getState().setIsPlaying(false);
    useAppStore.getState().setCurrentPlayingIndex(-1);
  }
}

export const engine = new AudioEngine();