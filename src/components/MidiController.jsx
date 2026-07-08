import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const MidiController = () => {
  const { edo, addActiveNote, removeActiveNote } = useAppStore();
  const [midiStatus, setMidiStatus] = useState('NOT INITIALIZED');

  useEffect(() => {
    let midiAccess = null;

    const onMIDISuccess = (access) => {
      midiAccess = access;
      updateStatus(access);

      // Назначаем обработчик на все доступные MIDI-входы
      for (let input of access.inputs.values()) {
        input.onmidimessage = handleMidiMessage;
      }

      // Следим за подключением/отключением устройств в реальном времени
      access.onstatechange = () => {
        updateStatus(access);
        // Переназначаем обработчики для новых устройств
        for (let input of access.inputs.values()) {
          input.onmidimessage = handleMidiMessage;
        }
      };
    };

    const onMIDIFailure = () => {
      setMidiStatus('MIDI FAILURE / BLOCKED');
    };

    const updateStatus = (access) => {
      const inputs = Array.from(access.inputs.values());
      if (inputs.length > 0) {
        // Выводим имя первого подключенного устройства
        setMidiStatus(`READY: ${inputs[0].name.toUpperCase()}`);
      } else {
        setMidiStatus('NO DEVICES DETECTED');
      }
    };

    const handleMidiMessage = async (message) => {
      const [status, midiNote, velocity] = message.data;

      // Мапим MIDI ноту (60 — это Middle C / До первой октавы) в шаг нашего EDO
      const noteIndex = ((midiNote - 60) % edo + edo) % edo;

      // Note On (клавиша нажата, velocity > 0)
      if (status >= 144 && status <= 159 && velocity > 0) {
        await engine.init();
        engine.playNote(noteIndex);
        addActiveNote(noteIndex);
      } 
      // Note Off (клавиша отпущена или Note On с нулевой силой нажатия)
      else if ((status >= 128 && status <= 143) || (status >= 144 && status <= 159 && velocity === 0)) {
        engine.stopNote(noteIndex);
        removeActiveNote(noteIndex);
      }
    };

    // Проверяем поддержку Web MIDI API в браузере
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
      setMidiStatus('MIDI NOT SUPPORTED BY BROWSER');
    }

    return () => {
      if (midiAccess) {
        for (let input of midiAccess.inputs.values()) {
          input.onmidimessage = null;
        }
      }
    };
  }, [edo]); // Перезапускаем при смене EDO, чтобы правильно вычислять остаток от деления

  return (
    <div style={{ fontSize: '12px', color: '#666', border: '1px solid #222', padding: '6px 12px', display: 'inline-block' }}>
      MIDI_PORT = [ {midiStatus} ]
    </div>
  );
};

export default MidiController;