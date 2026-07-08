import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';
import { getScaleNotesForEdo } from '../utils/mathUtils';

// Карта ФИЗИЧЕСКИХ клавиш (e.code) -> Индекс ноты. Теперь работает при любой раскладке!
const KEY_MAP = {
  // Нижний ряд (Z - /)
  'KeyZ': 0, 'KeyX': 1, 'KeyC': 2, 'KeyV': 3, 'KeyB': 4, 'KeyN': 5, 'KeyM': 6, 'Comma': 7, 'Period': 8, 'Slash': 9,
  // Средний ряд (A - ')
  'KeyA': 10, 'KeyS': 11, 'KeyD': 12, 'KeyF': 13, 'KeyG': 14, 'KeyH': 15, 'KeyJ': 16, 'KeyK': 17, 'KeyL': 18, 'Semicolon': 19, 'Quote': 20,
  // Верхний ряд (Q - P)
  'KeyQ': 21, 'KeyW': 22, 'KeyE': 23, 'KeyR': 24, 'KeyT': 25, 'KeyY': 26, 'KeyU': 27, 'KeyI': 28, 'KeyO': 29, 'KeyP': 30,
  // Цифры
  'Digit1': 31, 'Digit2': 32, 'Digit3': 33, 'Digit4': 34, 'Digit5': 35
};

const KeyboardController = () => {
  const { edo, currentScale, addActiveNote, removeActiveNote } = useAppStore();

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.repeat) return; 

      const code = e.code;
      if (KEY_MAP[code] !== undefined) {
        const noteIndex = KEY_MAP[code];
        if (noteIndex >= edo) return;

        const allowedNotes = getScaleNotesForEdo(currentScale, edo);
        if (!allowedNotes.includes(noteIndex)) return;

        // ИСПРАВЛЕНИЕ БАГА: Читаем стейт напрямую. Если нота уже нажата мышкой, не запускаем синтезатор второй раз.
        if (useAppStore.getState().activeNotes.includes(noteIndex)) return;

        await engine.init();
        engine.playNote(noteIndex);
        addActiveNote(noteIndex);
      }
    };

    const handleKeyUp = (e) => {
      const code = e.code;
      if (KEY_MAP[code] !== undefined) {
        const noteIndex = KEY_MAP[code];
        
        if (noteIndex >= edo) return;

        engine.stopNote(noteIndex);
        removeActiveNote(noteIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [edo, currentScale]); // Перезапускаем при изменении EDO или лада

  return null;
};

export default KeyboardController;