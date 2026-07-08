import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const SequencerControls = () => {
  const { isPlaying } = useAppStore();

  const handleTogglePlay = async () => {
    if (isPlaying) {
      engine.stopSequencer();
    } else {
      await engine.startSequencer();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <button 
        className={`ut-button ${isPlaying ? 'active' : ''}`}
        onClick={handleTogglePlay}
      >
        {isPlaying ? '■ STOP PATTERN' : '▶ PLAY PATTERN'}
      </button>
    </div>
  );
};

export default SequencerControls;