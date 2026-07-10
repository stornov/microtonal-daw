import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const MidiController = () => {
  const { edo, activeBlockId, addNoteToActiveBlock, removeNoteFromActiveBlock, addLiveKeypress, removeLiveKeypress, hexOctaveShift } = useAppStore();
  const [midiStatus, setMidiStatus] = useState('NOT INITIALIZED');
  const activeMidiNotesRef = useRef({}); 

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
      
      const baseIndex = midiNote - 60; 
      const noteIndex = baseIndex + hexOctaveShift * edo;

      if (noteIndex < -96 || noteIndex > 186) return;

      if (status >= 144 && status <= 159 && velocity > 0) {
        await engine.init();
        engine.playNote(noteIndex);
        
        addLiveKeypress(noteIndex);
        activeMidiNotesRef.current[midiNote] = noteIndex; 

        if (activeBlockId) {
          addNoteToActiveBlock(noteIndex);
        }
      } 
      else if ((status >= 128 && status <= 143) || (status >= 144 && status <= 159 && velocity === 0)) {
        if (activeMidiNotesRef.current[midiNote] !== undefined) {
          const originalNoteIndex = activeMidiNotesRef.current[midiNote];

          engine.stopNote(originalNoteIndex);
          removeLiveKeypress(originalNoteIndex);
          
          delete activeMidiNotesRef.current[midiNote];

          if (activeBlockId) {
            removeNoteFromActiveBlock(originalNoteIndex);
          }
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
  }, [edo, activeBlockId, addNoteToActiveBlock, removeNoteFromActiveBlock, addLiveKeypress, removeLiveKeypress, hexOctaveShift]);

  return (
    <div style={{ fontSize: '12px', color: '#666', border: '1px solid #222', padding: '6px 12px', display: 'inline-block' }}>
      MIDI_PORT = [ {midiStatus} ]
    </div>
  );
};

export default MidiController;