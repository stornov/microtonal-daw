import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_TRACKS } from '../utils/demoTracks';

const DEFAULT_TRACKS = [
  { id: 'track_1', name: 'STREAM 1', volume: 1.0, isMuted: false, isSolo: false },
  { id: 'track_2', name: 'STREAM 2', volume: 1.0, isMuted: false, isSolo: false },
  { id: 'track_3', name: 'STREAM 3', volume: 1.0, isMuted: false, isSolo: false },
  { id: 'track_4', name: 'TRACK 4', volume: 1.0, isMuted: false, isSolo: false }
];

const DEFAULT_INSTRUMENTS = [
  { id: 'triangle', name: 'TRIANGLE', color: '#59DC90', waveType: 'triangle', attack: 100, decay: 300, sustain: 90, release: 1500, reverb: 0.2, delay: 0.1, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
  { id: 'saw', name: 'SAW', color: '#ED6ED8', waveType: 'sawtooth', attack: 50, decay: 200, sustain: 100, release: 800, reverb: 0.3, delay: 0.2, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
  { id: 'square', name: 'SQUARE', color: '#7FFDEB', waveType: 'square', attack: 10, decay: 150, sustain: 80, release: 500, reverb: 0.1, delay: 0.1, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false },
  { id: 'sine', name: 'SINE', color: '#FFCE32', waveType: 'sine', attack: 200, decay: 400, sustain: 120, release: 2000, reverb: 0.0, delay: 0.0, a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false }
];

const PALETTE = ['#59DC90', '#ED6ED8', '#7FFDEB', '#FFCE32', '#FF4444', '#47bfff', '#ffaa00'];

export const useAppStore = create(
  persist(
    (set, get) => ({
      edo: 31,
      volume: 0.5,
      isPlaying: false,
      tempo: 130,
      isExporting: false,
      showCircleLabels: true,
      hexOctaveShift: 0,
      circleZoom: 1.0, 
      autoScroll: true, 
      visGain: 0.85,
      visLineWidth: 1.5,
      visDecay: 0.18,
      snapGrid: 0.25,
      timelineZoom: 40,
      isEditing: false, 
      isRecording: false,

      setVisGain: (val) => set({ visGain: Number(val) }),
      setVisLineWidth: (val) => set({ visLineWidth: Number(val) }),
      setVisDecay: (val) => set({ visDecay: Number(val) }),
      setAutoScroll: (val) => set({ autoScroll: val }),
      setSnapGrid: (val) => set({ snapGrid: Number(val) }),
      setTimelineZoom: (val) => set({ timelineZoom: Number(val) }),
      setIsEditing: (val) => set({ isEditing: val }),
      setIsRecording: (val) => set({ isRecording: val }),
      
      setIsExporting: (val) => set({ isExporting: val }),
      
      tracks: DEFAULT_TRACKS,
      instruments: DEFAULT_INSTRUMENTS,
      currentInstrumentId: 'triangle', 

      blocks: DEMO_TRACKS?.smart_aleck?.blocks || [], 
      activeBlockId: null,
      liveActiveNotes: {}, 
      liveKeypresses: [], 

      setCircleZoom: (val) => set({ circleZoom: Number(val) }),
      setHexOctaveShift: (val) => set({ hexOctaveShift: Number(val) }),
      setShowCircleLabels: (val) => set({ showCircleLabels: val }),

      setTempo: (t) => {
        get().pushToHistory(); 
        set({ tempo: Number(t), activeDemoKey: 'custom' });
      },

      setLiveKeypresses: (notes) => set({ liveKeypresses: notes }),
      addLiveKeypress: (noteIndex) => set((state) => ({
        liveKeypresses: [...new Set([...state.liveKeypresses, noteIndex])]
      })),
      removeLiveKeypress: (noteIndex) => set((state) => ({
        liveKeypresses: state.liveKeypresses.filter(n => n !== noteIndex)
      })),

      addLiveActiveNote: (blockId, notes, color) => set((state) => ({
        liveActiveNotes: { ...state.liveActiveNotes, [blockId]: { notes, color } }
      })),
      removeLiveActiveNote: (blockId) => set((state) => {
        const newNotes = { ...state.liveActiveNotes };
        delete newNotes[blockId];
        return { liveActiveNotes: newNotes };
      }),
      clearLiveActiveNotes: () => set({ liveActiveNotes: {} }),

      pushToHistory: () => set((state) => {
        const currentSnapshot = {
          blocks: JSON.parse(JSON.stringify(state.blocks)),
          tracks: JSON.parse(JSON.stringify(state.tracks))
        };
        const newPast = [...state.historyPast, currentSnapshot].slice(-30); 
        return {
          historyPast: newPast,
          historyFuture: [] 
        };
      }),

      undo: () => set((state) => {
        if (state.historyPast.length === 0) return state;

        const currentSnapshot = {
          blocks: JSON.parse(JSON.stringify(state.blocks)),
          tracks: JSON.parse(JSON.stringify(state.tracks))
        };

        const previous = state.historyPast[state.historyPast.length - 1];
        const remainingPast = state.historyPast.slice(0, -1);

        return {
          blocks: previous.blocks,
          tracks: previous.tracks,
          activeBlockId: previous.blocks.length > 0 ? previous.blocks[0].id : null,
          historyPast: remainingPast,
          historyFuture: [currentSnapshot, ...state.historyFuture].slice(0, 30),
          activeDemoKey: 'custom'
        };
      }),

      redo: () => set((state) => {
        if (state.historyFuture.length === 0) return state;

        const currentSnapshot = {
          blocks: JSON.parse(JSON.stringify(state.blocks)),
          tracks: JSON.parse(JSON.stringify(state.tracks))
        };

        const next = state.historyFuture[0];
        const remainingFuture = state.historyFuture.slice(1);

        return {
          blocks: next.blocks,
          tracks: next.tracks,
          activeBlockId: next.blocks.length > 0 ? next.blocks[0].id : null,
          historyPast: [...state.historyPast, currentSnapshot].slice(-30),
          historyFuture: remainingFuture,
          activeDemoKey: 'custom'
        };
      }),

      loadDemoTrack: (key) => {
        const demo = DEMO_TRACKS?.[key];
        if (demo) {
          const formattedTracks = demo.tracks.map((t) => ({
            id: t.id,
            name: t.name,
            volume: t.volume ?? 1.0,
            isMuted: t.isMuted ?? false,
            isSolo: t.isSolo ?? false
          }));

          set({
            edo: demo.edo,
            tempo: demo.tempo,
            tracks: formattedTracks,
            blocks: demo.blocks,
            instruments: demo.instruments,
            activeBlockId: demo.blocks[0]?.id || null,
            currentInstrumentId: demo.blocks[0]?.instrumentId || 'triangle',
            isPlaying: false,
            liveActiveNotes: {},
            liveKeypresses: [],
            activeDemoKey: key,
            timelineZoom: 40,
            historyPast: [], 
            historyFuture: []
          });
        }
      },

      activeDemoKey: 'smart_aleck', 

      newProject: () => set({
        edo: 31,
        volume: 0.5,
        isPlaying: false,
        tempo: 120,
        tracks: DEFAULT_TRACKS,
        instruments: DEFAULT_INSTRUMENTS,
        currentInstrumentId: 'triangle',
        blocks: [], 
        activeBlockId: null,
        liveActiveNotes: {},
        liveKeypresses: [],
        hexOctaveShift: 0,
        showCircleLabels: true,
        isExporting: false,
        circleZoom: 1.0,
        activeDemoKey: 'empty',
        autoScroll: true,
        snapGrid: 0.25,
        timelineZoom: 40,
        historyPast: [],
        historyFuture: []
      }),

      loadProject: (projectData) => set({
        edo: projectData.edo ?? 31,
        tempo: projectData.tempo ?? 120,
        tracks: (projectData.tracks ?? DEFAULT_TRACKS).map((t) => ({
          id: t.id,
          name: t.name,
          volume: t.volume ?? 1.0,
          isMuted: t.isMuted ?? false,
          isSolo: t.isSolo ?? false
        })),
        blocks: projectData.blocks ?? [],
        instruments: projectData.instruments ?? DEFAULT_INSTRUMENTS,
        activeBlockId: projectData.blocks?.length > 0 ? projectData.blocks[0].id : null,
        currentInstrumentId: projectData.blocks?.length > 0 ? projectData.blocks[0].instrumentId : 'triangle',
        isPlaying: false,
        liveActiveNotes: {},
        liveKeypresses: [],
        hexOctaveShift: projectData.hexOctaveShift ?? 0,
        showCircleLabels: projectData.showCircleLabels ?? true,
        isExporting: false,
        circleZoom: projectData.circleZoom ?? 1.0,
        activeDemoKey: 'custom',
        autoScroll: projectData.autoScroll ?? true,
        snapGrid: projectData.snapGrid ?? 0.25,
        timelineZoom: 40,
        historyPast: [],
        historyFuture: []
      }),

      setActiveBlockId: (id) => set((state) => {
        const block = state.blocks.find(b => b.id === id);
        if (block) {
          return { activeBlockId: id, currentInstrumentId: block.instrumentId };
        }
        return { activeBlockId: id };
      }),

      addTrack: () => set((state) => {
        get().pushToHistory(); 
        const id = `track_${Date.now()}`;
        return { 
          activeDemoKey: 'custom', 
          tracks: [...state.tracks, { 
            id, 
            name: `STREAM ${state.tracks.length + 1}`,
            volume: 1.0,
            isMuted: false,
            isSolo: false
          }] 
        };
      }),

      deleteTrack: (trackId) => set((state) => {
        if (state.tracks.length <= 1) return state;
        get().pushToHistory(); 
        const newTracks = state.tracks.filter(t => t.id !== trackId);
        const newBlocks = state.blocks.filter(b => b.trackId !== trackId);
        const activeBlockStillExists = newBlocks.some(b => b.id === state.activeBlockId);
        const nextActiveId = activeBlockStillExists ? state.activeBlockId : (newBlocks.length > 0 ? newBlocks[0].id : null);
        return { tracks: newTracks, blocks: newBlocks, activeBlockId: nextActiveId, activeDemoKey: 'custom' };
      }),

      updateTrack: (trackId, params) => set((state) => {
        get().pushToHistory(); 
        return {
          activeDemoKey: 'custom',
          tracks: state.tracks.map(t => t.id === trackId ? { ...t, ...params } : t)
        };
      }),

      toggleTrackMute: (trackId) => set((state) => ({
        tracks: state.tracks.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t)
      })),
      toggleTrackSolo: (trackId) => set((state) => ({
        tracks: state.tracks.map(t => t.id === trackId ? { ...t, isSolo: !t.isSolo } : t)
      })),
      setTrackVolume: (trackId, volume) => set((state) => ({
        tracks: state.tracks.map(t => t.id === trackId ? { ...t, volume: Number(volume) } : t)
      })),

      addBlock: (trackId, startBeat = 0) => set((state) => {
        get().pushToHistory(); 
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
          activeBlockId: newId,
          activeDemoKey: 'custom'
        };
      }),

      duplicateBlock: (id) => set((state) => {
        get().pushToHistory(); 
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
          activeBlockId: newId,
          activeDemoKey: 'custom'
        };
      }),

      deleteBlock: (id) => set((state) => {
        get().pushToHistory(); 
        const newBlocks = state.blocks.filter(b => b.id !== id);
        const nextActiveId = newBlocks.length > 0 ? newBlocks[0].id : null;
        return { blocks: newBlocks, activeBlockId: nextActiveId, activeDemoKey: 'custom' };
      }),

      updateBlock: (id, params) => set((state) => ({
        activeDemoKey: 'custom',
        blocks: state.blocks.map(b => b.id === id ? { ...b, ...params } : b)
      })),

      updateInstrument: (id, params) => set((state) => {
        get().pushToHistory(); 
        return {
          activeDemoKey: 'custom',
          instruments: state.instruments.map(inst => inst.id === id ? { ...inst, ...params } : inst)
        };
      }),

      addNoteToActiveBlock: (noteIndex) => set((state) => {
        const activeBlock = state.blocks.find(b => b.id === state.activeBlockId);
        if (!activeBlock) return state;
        if (activeBlock.notes.includes(noteIndex)) return state;
        get().pushToHistory(); 
        const newNotes = [...activeBlock.notes, noteIndex].sort((a,b) => a - b);
        return {
          activeDemoKey: 'custom',
          blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: newNotes } : b)
        };
      }),

      removeNoteFromActiveBlock: (noteIndex) => set((state) => {
        const activeBlock = state.blocks.find(b => b.id === state.activeBlockId);
        if (!activeBlock) return state;
        get().pushToHistory(); 
        const newNotes = activeBlock.notes.filter(n => n !== noteIndex);
        return {
          activeDemoKey: 'custom',
          blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: newNotes } : b)
        };
      }),

      toggleNoteInActiveBlock: (noteIndex) => set((state) => {
        const activeBlock = state.blocks.find(b => b.id === state.activeBlockId);
        if (!activeBlock) return state;
        get().pushToHistory(); 
        const currentNotes = activeBlock.notes;
        let newNotes;
        if (currentNotes.includes(noteIndex)) {
          newNotes = currentNotes.filter(n => n !== noteIndex);
        } else {
          newNotes = [...currentNotes, noteIndex].sort((a, b) => a - b);
        }
        return {
          activeDemoKey: 'custom',
          blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: newNotes } : b)
        };
      }),

      addNoteToBlock: (blockId, noteIndex) => set((state) => {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return state;
        if (block.notes.includes(noteIndex)) return state;
        get().pushToHistory(); 
        const newNotes = [...block.notes, noteIndex].sort((a,b) => a - b);
        return {
          activeDemoKey: 'custom',
          blocks: state.blocks.map(b => b.id === blockId ? { ...b, notes: newNotes } : b)
        };
      }),

      removeNoteFromBlock: (blockId, noteIndex) => set((state) => {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return state;
        get().pushToHistory(); 
        const newNotes = block.notes.filter(n => n !== noteIndex);
        return {
          activeDemoKey: 'custom',
          blocks: state.blocks.map(b => b.id === blockId ? { ...b, notes: newNotes } : b)
        };
      }),

      clearActiveBlock: () => set((state) => {
        get().pushToHistory(); 
        return {
          activeDemoKey: 'custom',
          blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, notes: [] } : b)
        };
      }),

      setEdo: (newEdo) => {
        get().pushToHistory(); 
        set({ edo: newEdo, activeDemoKey: 'custom' });
      },
      setVolume: (vol) => set({ volume: Number(vol) }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
    }),
    {
      name: 'microtonal-daw-state-v1',
      partialize: (state) => {
        return {
          edo: state.edo,
          volume: state.volume,
          tempo: state.tempo,
          hexOctaveShift: state.hexOctaveShift,
          circleZoom: state.circleZoom,
          showCircleLabels: state.showCircleLabels,
          tracks: state.tracks,
          instruments: state.instruments,
          blocks: state.blocks,
          activeBlockId: state.activeBlockId,
          currentInstrumentId: state.currentInstrumentId,
          activeDemoKey: state.activeDemoKey,
          visGain: state.visGain,
          visLineWidth: state.visLineWidth,
          visDecay: state.visDecay,
          autoScroll: state.autoScroll,
          snapGrid: state.snapGrid,
          timelineZoom: state.timelineZoom
        };
      }
    }
  )
);