import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const Timeline = () => {
  const { 
    snapshots, 
    activeSnapshotId, 
    currentPlayingIndex, 
    isPlaying, 
    setActiveSnapshotId, 
    addSnapshot, 
    deleteActiveSnapshot, 
    duplicateActiveSnapshot, 
    updateActiveSnapshotDuration,
    clearActiveSnapshot
  } = useAppStore();

  const handlePlayToggle = async () => {
    if (isPlaying) {
      engine.stopSequencer();
    } else {
      await engine.startSequencer();
    }
  };

  return (
    <div style={{ border: '2px solid #fff', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#000' }}>
      
      {/* ПАНЕЛЬ КНОПОК */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="ut-btn" onClick={handlePlayToggle} style={{ borderColor: isPlaying ? '#ff4444' : '#fff', color: isPlaying ? '#ff4444' : '#fff' }}>
            {isPlaying ? '■ STOP SEQUENCE' : '▶ PLAY SEQUENCE'}
          </button>
          <button className="ut-btn" onClick={addSnapshot}>+ ADD CADRE</button>
          <button className="ut-btn" onClick={duplicateActiveSnapshot}>DUPLICATE</button>
          <button className="ut-btn" onClick={deleteActiveSnapshot} disabled={snapshots.length <= 1}>DELETE</button>
          <button className="ut-btn" onClick={clearActiveSnapshot}>CLEAR CADRE</button>
        </div>

        {/* НАСТРОЙКА ДЛИТЕЛЬНОСТИ ТЕКУЩЕГО КАДРА */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px' }}>CADRE DURATION:</span>
          <button className="ut-btn" style={{ padding: '2px 8px' }} onClick={() => updateActiveSnapshotDuration(-1)}>-</button>
          <span style={{ fontSize: '14px', fontWeight: 'bold', width: '80px', textAlign: 'center' }}>
            {snapshots.find(s => s.id === activeSnapshotId)?.duration || 4} BEATS
          </span>
          <button className="ut-btn" style={{ padding: '2px 8px' }} onClick={() => updateActiveSnapshotDuration(1)}>+</button>
        </div>
      </div>

      {/* ГОРИЗОНТАЛЬНАЯ ЛИНЕЙКА КАДРОВ */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
        {snapshots.map((snap, index) => {
          const isActive = snap.id === activeSnapshotId;
          const isPlayingNow = currentPlayingIndex === index;

          return (
            <div 
              key={snap.id}
              onClick={() => setActiveSnapshotId(snap.id)}
              style={{
                border: isPlayingNow ? '3px solid #ff4444' : (isActive ? '2px solid #fff' : '1px solid #444'),
                padding: '12px',
                minWidth: '130px',
                cursor: 'pointer',
                backgroundColor: isPlayingNow ? 'rgba(255, 68, 68, 0.1)' : (isActive ? '#111' : '#000'),
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '11px', color: isPlayingNow ? '#ff4444' : '#888', marginBottom: '5px' }}>
                {isPlayingNow ? '● PLAYING' : `CADRE ${index + 1}`}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {snap.duration} BEATS
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                L: {snap.layers['inst_1']?.length || 0} | B: {snap.layers['inst_2']?.length || 0}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default Timeline;