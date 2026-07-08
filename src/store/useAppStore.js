import { create } from 'zustand';

const DEFAULT_TRACKS = [
  { id: 'track_1', name: 'STREAM 1' },
  { id: 'track_2', name: 'STREAM 2' },
  { id: 'track_3', name: 'STREAM 3' },
  { id: 'track_4', name: 'TRACK 4' }
];

const DEFAULT_INSTRUMENTS = [
  { id: 'triangle', name: 'TRIANGLE', color: '#59DC90', waveType: 'triangle', attack: 100, decay: 300, sustain: 90, release: 1500, reverb: 0.2, delay: 0.1, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
  { id: 'saw', name: 'SAW', color: '#ED6ED8', waveType: 'sawtooth', attack: 50, decay: 200, sustain: 100, release: 800, reverb: 0.3, delay: 0.2, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
  { id: 'square', name: 'SQUARE', color: '#7FFDEB', waveType: 'square', attack: 10, decay: 150, sustain: 80, release: 500, reverb: 0.1, delay: 0.1, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
  { id: 'sine', name: 'SINE', color: '#FFCE32', waveType: 'sine', attack: 200, decay: 400, sustain: 120, release: 2000, reverb: 0.0, delay: 0.0, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false }
];

export const useAppStore = create((set, get) => ({
  edo: 31,
  volume: 0.5,
  isPlaying: false,
  tempo: 120,
  currentScale: 'chromatic', 

  tracks: DEFAULT_TRACKS,
  instruments: DEFAULT_INSTRUMENTS,
  currentInstrumentId: 'triangle', 

  blocks: [], 
  activeBlockId: null,
  currentPlayheadBeat: -1,
  liveActiveNotes: {}, 

  // --- НОВОЕ: ОТОБРАЖЕНИЕ ЦИФР НА КРУГЕ (Пункт 1) ---
  showCircleLabels: true,
  setShowCircleLabels: (val) => set({ showCircleLabels: val }),

  hexOctaveShift: 0, 
  setHexOctaveShift: (val) => set({ hexOctaveShift: Number(val) }),

  setTempo: (t) => set({ tempo: Number(t) }),
  setLiveActiveNotes: (notes) => set({ liveActiveNotes: notes }),
  setCurrentPlayheadBeat: (beat) => set({ currentPlayheadBeat: beat }),

  newProject: () => set({
    edo: 31,
    volume: 0.5,
    isPlaying: false,
    tempo: 120,
    currentScale: 'chromatic',
    tracks: DEFAULT_TRACKS,
    instruments: DEFAULT_INSTRUMENTS,
    currentInstrumentId: 'triangle',
    blocks: [], 
    activeBlockId: null,
    currentPlayheadBeat: -1,
    liveActiveNotes: {},
    hexOctaveShift: 0,
    showCircleLabels: true
  }),

  loadProject: (projectData) => set({
    edo: projectData.edo ?? 31,
    tempo: projectData.tempo ?? 120,
    currentScale: projectData.currentScale ?? 'chromatic',
    tracks: projectData.tracks ?? DEFAULT_TRACKS,
    blocks: projectData.blocks ?? [],
    instruments: projectData.instruments ?? DEFAULT_INSTRUMENTS,
    activeBlockId: projectData.blocks?.length > 0 ? projectData.blocks[0].id : null,
    currentInstrumentId: projectData.blocks?.length > 0 ? projectData.blocks[0].instrumentId : 'triangle',
    isPlaying: false,
    currentPlayheadBeat: -1,
    liveActiveNotes: {},
    hexOctaveShift: projectData.hexOctaveShift ?? 0,
    showCircleLabels: projectData.showCircleLabels ?? true
  }),

  setActiveBlockId: (id) => set((state) => {
    const block = state.blocks.find(b => b.id === id);
    if (block) {
      return { activeBlockId: id, currentInstrumentId: block.instrumentId };
    }
    return { activeBlockId: id };
  }),

  addTrack: () => set((state) => {
    const id = `track_${Date.now()}`;
    return { tracks: [...state.tracks, { id, name: `STREAM ${state.tracks.length + 1}` }] };
  }),

  deleteTrack: (trackId) => set((state) => {
    if (state.tracks.length <= 1) return state;
    const newTracks = state.tracks.filter(t => t.id !== trackId);
    const newBlocks = state.blocks.filter(b => b.trackId !== trackId);
    const activeBlockStillExists = newBlocks.some(b => b.id === state.activeBlockId);
    const nextActiveId = activeBlockStillExists ? state.activeBlockId : (newBlocks.length > 0 ? newBlocks[0].id : null);
    return { tracks: newTracks, blocks: newBlocks, activeBlockId: nextActiveId };
  }),

  addBlock: (trackId, startBeat = 0) => set((state) => {
    const newId = `block_${Date.now()}`;
    const newBlock = {
      id: newId,
      trackId: trackId,
      startBeat: startBeat,
      durationBeats: 1.0, 
      durationSub: '1/4',
      instrumentId: state.currentInstrumentId, 
      baseFreq: 261.63, 
      notes: [],
      velocity: 100 
    };
    return {
      blocks: [...state.blocks, newBlock],
      activeBlockId: newId
    };
  }),

  duplicateBlock: (id) => set((state) => {
    const original = state.blocks.find(b => b.id === id);
    if (!original) return state;

    const newId = `block_${Date.now()}`;
    const newBlock = {
      id: newId,
      trackId: original.trackId,
      startBeat: original.startBeat + original.durationBeats, 
      durationBeats: original.durationBeats,
      durationSub: original.durationSub,
      instrumentId: original.instrumentId,
      baseFreq: original.baseFreq,
      notes: [...original.notes],
      velocity: original.velocity ?? 100 
    };

    return {
      blocks: [...state.blocks, newBlock],
      activeBlockId: newId 
    };
  }),

  deleteBlock: (id) => set((state) => {
    const newBlocks = state.blocks.filter(b => b.id !== id);
    const nextActiveId = newBlocks.length > 0 ? newBlocks[0].id : null;
    return { blocks: newBlocks, activeBlockId: nextActiveId };
  }),

  updateBlock: (id, params) => set((state) => ({
    blocks: state.blocks.map(b => b.id === id ? { ...b, ...params } : b)
  })),

  updateInstrument: (id, params) => set((state) => ({
    instruments: state.instruments.map(inst => inst.id === id ? { ...inst, ...params } : inst)
  })),

  addNoteToActiveBlock: (noteIndex) => set((state) => {
    const activeBlock = state.blocks.find(b => b.id === state.activeBlockId);
    if (!activeBlock) return state;
    if (activeBlock.notes.includes(noteIndex)) return state;
    const newNotes = [...activeBlock.notes, noteIndex].sort((a,b) => a - b);
    return {
      blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: newNotes } : b)
    };
  }),

  removeNoteFromActiveBlock: (noteIndex) => set((state) => {
    const activeBlock = state.blocks.find(b => b.id === state.activeBlockId);
    if (!activeBlock) return state;
    const newNotes = activeBlock.notes.filter(n => n !== noteIndex);
    return {
      blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: newNotes } : b)
    };
  }),

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

  togglePitchClassInActiveBlock: (chromaticIndex) => set((state) => {
    const activeBlock = state.blocks.find(b => b.id === state.activeBlockId);
    if (!activeBlock) return state;

    const edo = state.edo;
    const targetPC = ((chromaticIndex % edo) + edo) % edo; 

    const hasPitchClass = activeBlock.notes.some(n => ((n % edo) + edo) % edo === targetPC);

    let newNotes;
    if (hasPitchClass) {
      newNotes = activeBlock.notes.filter(n => ((n % edo) + edo) % edo !== targetPC);
    } else {
      newNotes = [...activeBlock.notes, targetPC].sort((a, b) => a - b);
    }

    return {
      blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: newNotes } : b)
    };
  }),

  clearActiveBlock: () => set((state) => ({
    blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: [] } : b)
  })),

  setEdo: (newEdo) => set({ edo: newEdo, blocks: [] }),
  setVolume: (vol) => set({ volume: Number(vol) }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentScale: (scale) => set({ currentScale: scale }),
}));