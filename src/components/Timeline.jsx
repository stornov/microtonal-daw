import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';
import { formatBeatsToFraction } from '../utils/mathUtils';
import * as Tone from 'tone';

const Timeline = () => {
  const { 
    blocks, activeBlockId, isPlaying, tempo, setTempo,
    instruments, tracks, 
    setActiveBlockId, addBlock, deleteBlock, updateBlock, clearActiveBlock,
    addTrack, deleteTrack, duplicateBlock,
    autoScroll, setAutoScroll 
  } = useAppStore();

  const timelineScrollRef = useRef(null);
  const playheadRef = useRef(null);
  const zoomX = 40; 
  const lastStopClickRef = useRef(0); 

  const activeBlock = blocks.find(b => b.id === activeBlockId);
  const totalTimelineWidth = 120 + 1024 * 4 * zoomX;

  const handlePlay = async () => {
    if (isPlaying) return;
    await engine.startSequencer();
  };

  const handleStopClick = () => {
    const now = Date.now();
    const delay = 300; 

    if (now - lastStopClickRef.current < delay) {
      engine.stopAllImmediate(); 
      Tone.Transport.ticks = 0; 
      if (playheadRef.current) playheadRef.current.style.left = '120px';
    } else {
      engine.stopSequencer();
    }
    
    lastStopClickRef.current = now;
  };

  const handleClearCadre = () => {
    if (window.confirm("ARE YOU SURE YOU WANT TO CLEAR ALL NOTES IN THIS CADRE?")) {
      clearActiveBlock();
    }
  };

  const handleDeleteTrack = (trackId, index) => {
    const streamName = `STREAM ${index + 1}`;
    if (window.confirm(`ARE YOU SURE YOU WANT TO DELETE ${streamName} AND ALL ITS CADRES?`)) {
      deleteTrack(trackId);
    }
  };

  useEffect(() => {
    let animId;
    const updatePlayhead = () => {
      const ppq = Tone.Transport.PPQ || 192;
      const currentBeats = Tone.Transport.ticks / ppq;
      
      if (playheadRef.current) {
        if (Tone.Transport.state === 'started' || Tone.Transport.ticks > 0) {
          playheadRef.current.style.display = 'block';
          playheadRef.current.style.left = `${120 + currentBeats * zoomX}px`;
        } else {
          playheadRef.current.style.display = 'none';
        }
      }

      const isAuto = useAppStore.getState().autoScroll;
      const isPlay = useAppStore.getState().isPlaying;
      
      if (isAuto && isPlay && timelineScrollRef.current && currentBeats >= 0) {
        const container = timelineScrollRef.current;
        const playheadX = 120 + currentBeats * zoomX; 
        const rightBoundary = container.scrollLeft + container.clientWidth - 80;
        
        if (playheadX > rightBoundary) {
          container.scrollLeft = playheadX - 150;
        }
        if (currentBeats < 0.1) {
          container.scrollLeft = 0;
        }
      }

      animId = requestAnimationFrame(updatePlayhead);
    };
    updatePlayhead();
    return () => cancelAnimationFrame(animId);
  }, [zoomX]);

  const handleRulerMouseDown = (e) => {
    e.preventDefault();
    const scrollContainer = timelineScrollRef.current;
    if (!scrollContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect(); 
    const ppq = Tone.Transport.PPQ || 192;

    const setPositionFromEvent = (clientX) => {
      const scrollOffset = scrollContainer.scrollLeft;
      const xOnRuler = clientX - containerRect.left - 120 + scrollOffset;
      const beats = Math.max(0, xOnRuler / zoomX);
      const snappedBeats = Math.round(beats / 0.125) * 0.125; 
      
      Tone.Transport.ticks = snappedBeats * ppq;
    };

    setPositionFromEvent(e.clientX);

    const handleMouseMove = (moveEvent) => {
      setPositionFromEvent(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTrackLaneClick = (e, trackId) => {
    if (e.button !== 0) return; 
    if (e.target !== e.currentTarget) return; 

    if (activeBlockId) {
      setActiveBlockId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const beats = clickX / zoomX;
    const snappedBeat = Math.max(0, Math.floor(beats * 4) / 4);
    addBlock(trackId, snappedBeat);
  };

  const handleBlockMouseDown = (e, block) => {
    if (e.button !== 0) return; 
    
    e.preventDefault();
    setActiveBlockId(block.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originalStartBeat = block.startBeat;
    const originalTrackId = block.trackId;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const beatDelta = Math.round((dx / zoomX) * 4) / 4; 
      const newStartBeat = Math.max(0, originalStartBeat + beatDelta);

      const rowOffset = Math.round(dy / 45); 
      const currentTrackIndex = tracks.findIndex(t => t.id === originalTrackId);
      let newTrackIndex = currentTrackIndex + rowOffset;
      newTrackIndex = Math.max(0, Math.min(tracks.length - 1, newTrackIndex));
      
      const newTrackId = tracks[newTrackIndex].id;

      updateBlock(block.id, { startBeat: newStartBeat, trackId: newTrackId });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e, block) => {
    e.stopPropagation(); 
    e.preventDefault();

    const startX = e.clientX;
    const originalDurationBeats = block.durationBeats;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const beatDelta = dx / zoomX;
      
      const snappedDelta = Math.round(beatDelta / 0.125) * 0.125;
      const newDurationBeats = Math.max(0.125, originalDurationBeats + snappedDelta);

      updateBlock(block.id, { durationBeats: newDurationBeats });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div style={{ border: '2px solid #fff', padding: '12px', backgroundColor: '#000', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: 0, height: '100%' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', height: '30px' }}>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

          <button className={`ut-btn ${isPlaying ? 'active' : ''}`} onClick={handlePlay} style={{ borderColor: '#59DC90', color: '#59DC90' }}>
            ▶ PLAY
          </button>
          
          <button className="ut-btn" onClick={handleStopClick} style={{ borderColor: '#ff4444', color: '#ff4444' }}>
            ■ STOP
          </button>

          <button className="ut-btn" onClick={addTrack} style={{ borderColor: '#fff', color: '#fff', marginLeft: '10px' }}>
            + STREAM
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #333', paddingLeft: '15px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>BPM:</span>
            <input 
              type="range" min="60" max="220" 
              style={{ width: '80px', accentColor: '#fff', cursor: 'pointer' }}
              value={tempo} onChange={(e) => setTempo(e.target.value)} 
            />
            <input 
              type="number" style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
              value={tempo}
              onChange={(e) => setTempo(Math.min(220, Math.max(60, parseInt(e.target.value) || 120)))}
            />
          </div>

          <button 
            className="ut-btn"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{ 
              fontSize: '11px', 
              padding: '6px 12px', 
              borderLeft: '1px solid #333',
              border: '2px solid #7FFDEB', 
              backgroundColor: autoScroll ? '#7FFDEB' : '#000',
              color: autoScroll ? '#000' : '#7FFDEB',
              marginLeft: '15px'
            }}
          >
            SCROLL: {autoScroll ? 'ON' : 'OFF'}
          </button>

        </div>

        {activeBlock && (
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', borderLeft: '1px solid #333', paddingLeft: '15px' }}>
            <span style={{ fontSize: '12px', color: '#ffce32', fontWeight: 'bold' }}>
              LEN: {formatBeatsToFraction(activeBlock.durationBeats)}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>VEL:</span>
              <input 
                type="range" 
                min="0" max="127" 
                style={{ width: '60px', accentColor: '#fff', cursor: 'pointer' }}
                value={activeBlock.velocity ?? 100} 
                onChange={(e) => updateBlock(activeBlock.id, { velocity: parseInt(e.target.value) })}
              />
              <input 
                type="number" style={{ width: '40px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
                value={activeBlock.velocity ?? 100}
                onChange={(e) => updateBlock(activeBlock.id, { velocity: Math.min(127, Math.max(0, parseInt(e.target.value) || 0)) })}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', border: '1px dashed #555', padding: '4px 8px', backgroundColor: '#111' }}>
              <span style={{ fontSize: '10px', color: '#888', marginRight: '4px' }}>CADRE ACTIONS:</span>
              <button 
                className="ut-btn" 
                style={{ fontSize: '10px', padding: '4px 8px', borderColor: '#59DC90', color: '#59DC90' }}
                onClick={() => duplicateBlock(activeBlock.id)}
              >
                DUPLICATE
              </button>
              <button 
                className="ut-btn" 
                style={{ fontSize: '10px', padding: '4px 8px', borderColor: '#ffaa00', color: '#ffaa00' }} 
                onClick={handleClearCadre}
              >
                CLEAR NOTES
              </button>
              <button 
                className="ut-btn" 
                style={{ fontSize: '10px', padding: '4px 8px', borderColor: '#ff4444', color: '#ff4444' }} 
                onClick={() => deleteBlock(activeBlock.id)}
              >
                DELETE
              </button>
            </div>
          </div>
        )}
      </div>

      <div 
        ref={timelineScrollRef}
        style={{ position: 'relative', overflowX: 'auto', flex: 1, border: '1px solid #222', backgroundColor: '#050505' }}
      >
        
        <div 
          onMouseDown={handleRulerMouseDown} 
          style={{ display: 'flex', height: '20px', backgroundColor: '#111', borderBottom: '1px solid #333', position: 'sticky', top: 0, zIndex: 10, cursor: 'col-resize', width: `${totalTimelineWidth}px` }}
        >
          <div style={{ width: '120px', backgroundColor: '#000', borderRight: '1px solid #333' }} onMouseDown={e => e.stopPropagation()} />
          <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
            {Array.from({ length: 1024 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${i * 4 * zoomX}px`, 
                width: `${4 * zoomX}px`,
                height: '100%',
                borderLeft: '1px solid #333',
                paddingLeft: '4px',
                fontSize: '8px',
                color: '#666',
                lineHeight: '20px',
                pointerEvents: 'none'
              }}>
                BAR {i + 1}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', width: `${totalTimelineWidth}px` }}>
          
          <div ref={playheadRef} style={{
            position: 'absolute', top: 0, bottom: 0,
            width: '2px', backgroundColor: '#ff4444', zIndex: 100, pointerEvents: 'none',
            display: 'none'
          }} />

          {tracks.map((track, trackIndex) => (
            <div 
              key={track.id}
              style={{ display: 'flex', alignItems: 'center', height: '45px', borderBottom: '1px solid #222', position: 'relative' }}
            >
              <div style={{ 
                width: '120px', height: '100%', backgroundColor: '#111', borderRight: '1px solid #333', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px',
                fontSize: '9px', fontWeight: 'bold', zIndex: 5
              }}>
                <span>STREAM {trackIndex + 1}</span>
                {tracks.length > 1 && (
                  <span 
                    onClick={() => handleDeleteTrack(track.id, trackIndex)} 
                    style={{ color: '#ff4444', cursor: 'pointer', fontSize: '9px', padding: '2px 4px' }}
                  >
                    [X]
                  </span>
                )}
              </div>

              <div 
                onMouseDown={(e) => handleTrackLaneClick(e, track.id)}
                style={{ flex: 1, height: '100%', position: 'relative', cursor: 'cell' }}
              >
                {blocks
                  .filter(b => b.trackId === track.id)
                  .map((block) => {
                    const width = block.durationBeats * zoomX;
                    const left = block.startBeat * zoomX;
                    const isSelected = block.id === activeBlockId;
                    const inst = instruments.find(i => i.id === block.instrumentId) || instruments[0];

                    return (
                      <div
                        key={block.id}
                        onMouseDown={(e) => handleBlockMouseDown(e, block)} 
                        onClick={() => setActiveBlockId(block.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteBlock(block.id);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${left}px`,
                          width: `${width}px`,
                          height: '35px',
                          top: '5px',
                          border: isSelected ? '2px solid #fff' : `1px solid ${inst.color}`,
                          backgroundColor: isSelected ? inst.color : `${inst.color}15`,
                          color: isSelected ? '#000' : '#fff',
                          cursor: 'grab',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px',
                          fontWeight: 'bold',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          zIndex: 6
                        }}
                      >
                        <div>{inst.name}</div>
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(e, block)}
                          style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0,
                            width: '8px', cursor: 'ew-resize',
                            backgroundColor: 'rgba(255,255,255,0.2)'
                          }}
                        />
                      </div>
                    );
                  })}
              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Timeline;