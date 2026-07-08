import { create } from 'zustand';
import { SUBDIVISIONS } from '../utils/mathUtils';

export const useAppStore = create((set, get) => ({
  edo: 31,
  baseFreq: 261.63, // C4
  volume: 0.5,
  isPlaying: false,
  tempo: 120,
  
  // Режим выбора тональности кликом по кругу/сотам
  isSetRootMode: false,
  setSetRootMode: (val) => set({ isSetRootMode: val }),

  // Цвета инструментов Deltarune
  instruments: [
    { id: 'inst_1', name: 'HERO LEAD', color: '#59DC90', waveType: 'triangle', attack: 100, decay: 300, sustain: 90, release: 1500, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
    { id: 'inst_2', name: 'DARK WAVE', color: '#ED6ED8', waveType: 'sawtooth', attack: 50, decay: 200, sustain: 100, release: 800, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
    { id: 'inst_3', name: 'LIGHT SQUARE', color: '#7FFDEB', waveType: 'square', attack: 10, decay: 150, sustain: 80, release: 500, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
    { id: 'inst_4', name: 'DEEP SINE BASS', color: '#FFCE32', waveType: 'sine', attack: 200, decay: 400, sustain: 120, release: 2000, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false }
  ],
  currentInstrumentId: 'inst_1',
  setCurrentInstrument: (id) => set({ currentInstrumentId: id }),

  // Обновление параметров инструмента (ADSR, WaveType)
  updateInstrument: (id, params) => set((state) => ({
    instruments: state.instruments.map(inst => inst.id === id ? { ...inst, ...params } : inst)
  })),

  // --- МУЛЬТИ-ТРЕК ТАЙМЛАЙН БЛОКОВ ---
  // Блоки привязаны к трекам (каждому треку соответствует свой инструмент)
  blocks: [
    { id: 'b1', trackId: 'inst_1', startBeat: 0.0, durationSub: '1/1', notes: [15, 2] },
    { id: 'b2', trackId: 'inst_1', startBeat: 4.0, durationSub: '1/2', notes: [15, 2, 10] },
    { id: 'b3', trackId: 'inst_2', startBeat: 0.0, durationSub: '1/1', notes: [5] },
    { id: 'b4', trackId: 'inst_4', startBeat: 2.0, durationSub: '1/1', notes: [0] }
  ],
  activeBlockId: 'b1', // Выбранный блок для редактирования на круге/сотах
  currentPlayheadBeat: -1, // Положение курсора воспроизведения в долях
  
  // Текущие играющие ноты прямо сейчас (для визуализаторов во время игры)
  // { noteIndex: [trackColors] }
  liveActiveNotes: {},

  setTempo: (t) => set({ tempo: Number(t) }),
  setActiveBlockId: (id) => set({ activeBlockId: id }),
  setLiveActiveNotes: (notes) => set({ liveActiveNotes: notes }),
  setCurrentPlayheadBeat: (beat) => set({ currentPlayheadBeat: beat }),

  // Добавление блока на таймлайн
  addBlock: (trackId, startBeat = 0) => set((state) => {
    const newId = `block_${Date.now()}`;
    const newBlock = {
      id: newId,
      trackId: trackId,
      startBeat: startBeat,
      durationSub: '1/4',
      notes: []
    };
    return {
      blocks: [...state.blocks, newBlock],
      activeBlockId: newId
    };
  }),

  // Удаление блока
  deleteBlock: (id) => set((state) => {
    const newBlocks = state.blocks.filter(b => b.id !== id);
    const nextActiveId = newBlocks.length > 0 ? newBlocks[0].id : null;
    return { blocks: newBlocks, activeBlockId: nextActiveId };
  }),

  // Обновление блока (длительность, позиция)
  updateBlock: (id, params) => set((state) => ({
    blocks: state.blocks.map(b => b.id === id ? { ...b, ...params } : b)
  })),

  // Клик по ноте на круге/сотах во время редактирования
  toggleNoteInActiveBlock: (noteIndex) => set((state) => {
    const activeBlock = state.blocks.find(b => b.id === state.activeBlockId);
    if (!activeBlock) return state;

    const currentNotes = activeBlock.notes;
    let newNotes;
    if (currentNotes.includes(noteIndex)) {
      newNotes = currentNotes.filter(n => n !== noteIndex);
    } else {
      newNotes = [...currentNotes, noteIndex].sort((a, b) => a - b);
    }

    return {
      blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: newNotes } : b)
    };
  }),

  clearActiveBlock: () => set((state) => ({
    blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: [] } : b)
  })),

  setEdo: (newEdo) => set({ edo: newEdo, blocks: [] }),
  setBaseFreq: (freq) => set({ baseFreq: Number(freq) }),
  setVolume: (vol) => set({ volume: Number(vol) }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}));