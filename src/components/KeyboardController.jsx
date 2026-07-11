import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const KEY_MAP = {
  'KeyZ': 0, 'KeyX': 1, 'KeyC': 2, 'KeyV': 3, 'KeyB': 4, 'KeyN': 5, 'KeyM': 6, 'Comma': 7, 'Period': 8, 'Slash': 9,
  'KeyA': 10, 'KeyS': 11, 'KeyD': 12, 'KeyF': 13, 'KeyG': 14, 'KeyH': 15, 'KeyJ': 16, 'KeyK': 17, 'KeyL': 18, 'Semicolon': 19, 'Quote': 20,
  'KeyQ': 21, 'KeyW': 22, 'KeyE': 23, 'KeyR': 24, 'KeyT': 25, 'KeyY': 26, 'KeyU': 27, 'KeyI': 28, 'KeyO': 29, 'KeyP': 30,
  'Digit1': 31, 'Digit2': 32, 'Digit3': 33, 'Digit4': 34, 'Digit5': 35
};

const KeyboardController = () => {
  const { 
    edo, activeBlockId, addNoteToBlock, removeNoteFromBlock, 
    duplicateBlock, addLiveKeypress, removeLiveKeypress, hexOctaveShift,
    setActiveBlockId, undo, redo 
  } = useAppStore();
  
  const activeKeysRef = useRef({}); 

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (document.activeElement.tagName === 'INPUT') return;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) redo(); 
        else undo(); 
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        redo(); 
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        setActiveBlockId(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault(); 
        if (activeBlockId) duplicateBlock(activeBlockId);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); 
        const { isPlaying } = useAppStore.getState();
        if (isPlaying) {
          engine.stopSequencer();
        } else {
          await engine.startSequencer();
        }
        return;
      }

      const code = e.code;
      if (KEY_MAP[code] !== undefined) {
        if (activeKeysRef.current[code] !== undefined) return;

        const noteIndex = KEY_MAP[code] + hexOctaveShift * edo;
        if (noteIndex < -96 || noteIndex > 186) return;

        await engine.init();
        engine.playNote(noteIndex);
        
        addLiveKeypress(noteIndex);
        activeKeysRef.current[code] = { noteIndex, blockId: activeBlockId };
      }
    };

    const handleKeyUp = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;

      const code = e.code;
      if (activeKeysRef.current[code] !== undefined) {
        const { noteIndex } = activeKeysRef.current[code];

        engine.stopNote(noteIndex);
        removeLiveKeypress(noteIndex);
        
        delete activeKeysRef.current[code]; 
      }
    };

    const handleWindowBlur = () => {
      Object.values(activeKeysRef.current).forEach(({ noteIndex }) => {
        engine.stopNote(noteIndex);
      });
      useAppStore.getState().setLiveKeypresses([]);
      activeKeysRef.current = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [edo, activeBlockId, duplicateBlock, addLiveKeypress, removeLiveKeypress, hexOctaveShift, setActiveBlockId, undo, redo]);

  return null;
};

export default KeyboardController;