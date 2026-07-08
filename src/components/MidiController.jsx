import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';
import { getScaleNotesForEdo } from '../utils/mathUtils';

const MidiController = () => {
  const { edo, currentScale, activeBlockId, addNoteToActiveBlock, removeNoteFromActiveBlock } = useAppStore();
  const [midiStatus, setMidiStatus] = useState('NOT INITIALIZED');

  useEffect(() => {
    let midiAccess = null;

    const onMIDISuccess = (access) => {
      midiAccess = access;
      updateStatus(access);

      for (let input of access.inputs.values()) {
        input.onmidimessage = handleMidiMessage;
      }

      access.onstatechange = () => {
        updateStatus(access);
        for (let input of access.inputs.values()) {
          input.onmidimessage = handleMidiMessage;
        }
      };
    };

    const onMIDIFailure = () => {
      setMidiStatus('MIDI FAILURE');
    };

    const updateStatus = (access) => {
      const inputs = Array.from(access.inputs.values());
      if (inputs.length > 0) {
        setMidiStatus(`READY: ${inputs[0].name.toUpperCase()}`);
      } else {
        setMidiStatus('NO DEVICES DETECTED');
      }
    };

    const handleMidiMessage = async (message) => {
      const [status, midiNote, velocity] = message.data;

      // Мапим ноту линейно относительно Middle C (До первой октавы = шаг 0)
      const noteIndex = midiNote - 60; 

      // Вычисляем октавный сдвиг для проверки лада
      const wrappedIndex = ((noteIndex % edo) + edo) % edo;
      const allowedNotes = getScaleNotesForEdo(currentScale, edo);

      // Проверяем лад перед запуском звука
      if (!allowedNotes.includes(wrappedIndex)) return;

      // Note On
      if (status >= 144 && status <= 159 && velocity > 0) {
        await engine.init();
        engine.playNote(noteIndex);
        
        // Автоматически записываем ноту в активный кадр (Пункт 2)
        if (activeBlockId) {
          addNoteToActiveBlock(noteIndex);
        }
      } 
      // Note Off
      else if ((status >= 128 && status <= 143) || (status >= 144 && status <= 159 && velocity === 0)) {
        engine.stopNote(noteIndex);
        
        // Стираем ноту из активного кадра при отпускании (Пункт 2)
        if (activeBlockId) {
          removeNoteFromActiveBlock(noteIndex);
        }
      }
    };

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
      setMidiStatus('MIDI NOT SUPPORTED');
    }

    return () => {
      if (midiAccess) {
        for (let input of midiAccess.inputs.values()) {
          input.onmidimessage = null;
        }
      }
    };
  }, [edo, currentScale, activeBlockId, addNoteToActiveBlock, removeNoteFromActiveBlock]);

  return (
    <div style={{ fontSize: '12px', color: '#666', border: '1px solid #222', padding: '6px 12px', display: 'inline-block' }}>
      MIDI_PORT = [ {midiStatus} ]
    </div>
  );
};

export default MidiController;