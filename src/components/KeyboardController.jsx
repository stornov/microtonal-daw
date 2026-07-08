import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';
import { getScaleNotesForEdo } from '../utils/mathUtils';

const KEY_MAP = {
  'KeyZ': 0, 'KeyX': 1, 'KeyC': 2, 'KeyV': 3, 'KeyB': 4, 'KeyN': 5, 'KeyM': 6, 'Comma': 7, 'Period': 8, 'Slash': 9,
  'KeyA': 10, 'KeyS': 11, 'KeyD': 12, 'KeyF': 13, 'KeyG': 14, 'KeyH': 15, 'KeyJ': 16, 'KeyK': 17, 'KeyL': 18, 'Semicolon': 19, 'Quote': 20,
  'KeyQ': 21, 'KeyW': 22, 'KeyE': 23, 'KeyR': 24, 'KeyT': 25, 'KeyY': 26, 'KeyU': 27, 'KeyI': 28, 'KeyO': 29, 'KeyP': 30,
  'Digit1': 31, 'Digit2': 32, 'Digit3': 33, 'Digit4': 34, 'Digit5': 35
};

const KeyboardController = () => {
  const { edo, currentScale, activeBlockId, addNoteToActiveBlock, removeNoteFromActiveBlock, duplicateBlock, setActiveBlockId } = useAppStore();

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (document.activeElement.tagName === 'INPUT') return;

      // --- СБРОС ФОКУСА С БЛОКА НА ESCAPE ---
      if (e.code === 'Escape') {
        e.preventDefault();
        setActiveBlockId(null); // Убираем фокус
        return;
      }

      // Горячая клавиша Ctrl+D / Cmd+D для дублирования [5]
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault(); 
        if (activeBlockId) {
          duplicateBlock(activeBlockId);
        }
        return;
      }

      // Переключение воспроизведения на пробел [5]
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

      if (e.repeat) return; 

      const code = e.code;
      if (KEY_MAP[code] !== undefined) {
        const noteIndex = KEY_MAP[code];
        if (noteIndex >= edo) return;

        const allowedNotes = getScaleNotesForEdo(currentScale, edo);
        if (!allowedNotes.includes(noteIndex)) return;

        await engine.init();
        engine.playNote(noteIndex);
        
        if (activeBlockId) {
          addNoteToActiveBlock(noteIndex);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;

      const code = e.code;
      if (KEY_MAP[code] !== undefined) {
        const noteIndex = KEY_MAP[code];
        if (noteIndex >= edo) return;

        engine.stopNote(noteIndex);
        
        if (activeBlockId) {
          removeNoteFromActiveBlock(noteIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [edo, currentScale, activeBlockId, addNoteToActiveBlock, removeNoteFromActiveBlock, duplicateBlock, setActiveBlockId]);

  return null;
};

export default KeyboardController;