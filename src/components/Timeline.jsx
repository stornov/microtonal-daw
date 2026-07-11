import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';
import { formatBeatsToFraction } from '../utils/mathUtils';
import * as Tone from 'tone';

const Timeline = () => {
  const { 
    blocks, activeBlockId, isPlaying, tempo, setTempo,
    instruments, tracks, activeDemoKey,
    setActiveBlockId, addBlock, deleteBlock, updateBlock, clearActiveBlock,
    addTrack, deleteTrack, duplicateBlock, updateTrack,
    autoScroll, setAutoScroll,
    snapGrid, setSnapGrid,
    timelineZoom, setTimelineZoom,
    toggleTrackMute, toggleTrackSolo, setTrackVolume,
    isEditing, setIsEditing 
  } = useAppStore();

  const timelineScrollRef = useRef(null);
  const playheadRef = useRef(null); 
  const lastStopClickRef = useRef(0); 
  const [isPanning, setIsPanning] = useState(false); 

  const activeBlock = blocks.find(b => b.id === activeBlockId);
  const totalTimelineWidth = 180 + 1024 * 4 * timelineZoom; 

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
      if (playheadRef.current) playheadRef.current.style.left = '180px';
      if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = 0; 
    } else {
      engine.stopSequencer();
    }
    
    lastStopClickRef.current = now;
  };

  const handleClearCadre = () => {
    engine.stopSequencer(); 
    clearActiveBlock();
  };

  const handleDeleteTrack = (trackId, index) => {
    engine.stopSequencer(); 
    deleteTrack(trackId);
  };

  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) return;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onMouseDown = (e) => {
      if (e.button === 1) { 
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        setIsPanning(true);
        startX = e.clientX;
        startScrollLeft = container.scrollLeft;
      }
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      container.scrollLeft = startScrollLeft - dx;
    };

    const onMouseUp = (upEvent) => {
      if (isDragging) {
        upEvent.preventDefault();
        isDragging = false;
        setIsPanning(false);
      }
    };

    const onAuxClick = (e) => {
      if (e.button === 1) e.preventDefault(); 
    };

    container.addEventListener('mousedown', onMouseDown, { passive: false });
    container.addEventListener('auxclick', onAuxClick, { passive: false });
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp, { passive: false });

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('auxclick', onAuxClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft = 0;
    }
    if (playheadRef.current) {
      playheadRef.current.style.left = '180px';
      playheadRef.current.style.display = 'none';
    }
  }, [tracks.length, activeDemoKey]);

  useEffect(() => {
    let animId;
    const updatePlayhead = () => {
      const ppq = Tone.Transport.PPQ || 192;
      const currentBeats = Tone.Transport.ticks / ppq;
      
      if (playheadRef.current) {
        if (Tone.Transport.state === 'started' || Tone.Transport.ticks > 0) {
          playheadRef.current.style.display = 'block';
          playheadRef.current.style.left = `${180 + currentBeats * timelineZoom}px`;
        } else {
          playheadRef.current.style.display = 'none';
        }
      }

      const isAuto = useAppStore.getState().autoScroll;
      const isPlay = useAppStore.getState().isPlaying;
      
      if (isAuto && isPlay && timelineScrollRef.current && currentBeats >= 0) {
        const container = timelineScrollRef.current;
        const playheadX = 180 + currentBeats * timelineZoom; 
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
  }, [timelineZoom]);

  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault(); 
        const zoomFactor = e.deltaY < 0 ? 5 : -5;
        const currentZoom = useAppStore.getState().timelineZoom;
        setTimelineZoom(Math.min(150, Math.max(20, currentZoom + zoomFactor)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [setTimelineZoom]);

  const handleRulerMouseDown = (e) => {
    e.preventDefault();
    const scrollContainer = timelineScrollRef.current;
    if (!scrollContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect(); 
    const ppq = Tone.Transport.PPQ || 192;

    const setPositionFromEvent = (clientX) => {
      const scrollOffset = scrollContainer.scrollLeft;
      const xOnRuler = clientX - containerRect.left - 180 + scrollOffset;
      const beats = Math.max(0, xOnRuler / timelineZoom);
      const snappedBeats = Math.round(beats / snapGrid) * snapGrid; 
      
      Tone.Transport.ticks = snappedBeats * ppq;
      useAppStore.getState().clearLiveActiveNotes();
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

    engine.stopSequencer(); 

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const beats = clickX / timelineZoom;
    const snappedBeat = Math.max(0, Math.floor(beats / snapGrid) * snapGrid);
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

    let hasStopped = false;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!hasStopped && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        engine.stopSequencer();
        setIsEditing(true); 
        hasStopped = true;
      }

      const rawBeat = originalStartBeat + dx / timelineZoom;
      const snappedBeat = Math.max(0, Math.round(rawBeat / snapGrid) * snapGrid);

      const rowOffset = Math.round(dy / 45); 
      const currentTrackIndex = tracks.findIndex(t => t.id === originalTrackId);
      let newTrackIndex = currentTrackIndex + rowOffset;
      newTrackIndex = Math.max(0, Math.min(tracks.length - 1, newTrackIndex));
      
      const newTrackId = tracks[newTrackIndex].id;

      updateBlock(block.id, { startBeat: snappedBeat, trackId: newTrackId });
    };

    const handleMouseUp = () => {
      setIsEditing(false); 
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

    let hasStopped = false;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;

      if (!hasStopped && Math.abs(dx) > 3) {
        engine.stopSequencer();
        setIsEditing(true); 
        hasStopped = true;
      }

      const rawDuration = originalDurationBeats + dx / timelineZoom;
      const snappedDuration = Math.max(0.125, Math.round(rawDuration / 0.125) * 0.125);

      updateBlock(block.id, { durationBeats: snappedDuration });
    };

    const handleMouseUp = () => {
      setIsEditing(false); 
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div style={{ border: '2px solid #fff', padding: '12px', backgroundColor: '#000', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: 0, height: '100%' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid #222' }}>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

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
              type="range" min="20" max="300" 
              style={{ width: '80px', accentColor: '#fff', cursor: 'pointer' }}
              value={tempo} onChange={(e) => setTempo(e.target.value)} 
            />
            <input 
              type="number" style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
              value={tempo}
              onChange={(e) => setTempo(Math.max(1, parseInt(e.target.value) || 120))}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #333', paddingLeft: '15px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>SNAP:</span>
            <select 
              className="ut-select" 
              style={{ fontSize: '11px', padding: '2px 4px', borderColor: '#7FFDEB', color: '#7FFDEB' }}
              value={snapGrid} 
              onChange={(e) => setSnapGrid(e.target.value)}
            >
              <option value="4">1/1 (Whole)</option>
              <option value="2">1/2 (Half)</option>
              <option value="1">1/4 (Quarter)</option>
              <option value="0.5">1/8 (Eighth)</option>
              <option value="0.25">1/16 (Sixteenth)</option>
              <option value="0.125">1/32 (Thirty-second)</option>
              <option value="0.0625">1/64 (Sixty-fourth)</option>
              <option value="1.333333">1/3 (Half Triplet)</option>
              <option value="0.666666">1/6 (Quarter Triplet)</option>
              <option value="0.333333">1/12 (Eighth Triplet)</option>
              <option value="0.166666">1/24 (Sixteenth Triplet)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #333', paddingLeft: '15px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>ZOOM:</span>
            <input 
              type="range" min="20" max="150" step="5"
              style={{ width: '80px', accentColor: '#7FFDEB', cursor: 'pointer' }}
              value={timelineZoom} onChange={(e) => setTimelineZoom(e.target.value)} 
            />
            <span style={{ fontSize: '10px', color: '#888', minWidth: '30px' }}>{timelineZoom}px</span>
          </div>

          <button 
            className="ut-btn"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{ 
              fontSize: '11px', 
              padding: '6px 12px', 
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
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', borderLeft: '1px solid #333', paddingLeft: '15px', flexWrap: 'wrap' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#ffce32', fontWeight: 'bold' }}>
                LEN: {formatBeatsToFraction(activeBlock.durationBeats)}
              </span>
              <input 
                type="number" step="0.125" min="0.125"
                style={{ width: '60px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
                value={activeBlock.durationBeats}
                onChange={(e) => updateBlock(activeBlock.id, { durationBeats: Math.max(0.125, parseFloat(e.target.value) || 0.125) })}
              />
            </div>

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
                onClick={() => {
                  engine.stopSequencer(); 
                  duplicateBlock(activeBlock.id);
                }}
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
                onClick={() => {
                  if (window.confirm("ARE YOU SURE YOU WANT TO DELETE THIS CADRE?")) {
                    engine.stopSequencer(); 
                    deleteBlock(activeBlock.id);
                  }
                }}
              >
                DELETE
              </button>
            </div>
          </div>
        )}
      </div>

      <div 
        ref={timelineScrollRef}
        style={{ position: 'relative', overflowX: 'auto', flex: 1, border: '1px solid #222', backgroundColor: '#050505', cursor: isPanning ? 'grabbing' : 'default' }}
      >
        
        <div 
          onMouseDown={handleRulerMouseDown} 
          style={{ display: 'flex', height: '20px', backgroundColor: '#111', borderBottom: '1px solid #333', position: 'sticky', top: 0, zIndex: 15, cursor: 'col-resize', width: `${totalTimelineWidth}px` }}
        >
          <div style={{ width: '180px', backgroundColor: '#000', borderRight: '1px solid #333', position: 'sticky', left: 0, zIndex: 125 }} onMouseDown={e => e.stopPropagation()} />
          <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
            {Array.from({ length: 1024 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${i * 4 * timelineZoom}px`, 
                width: `${4 * timelineZoom}px`,
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

          {tracks.map((track, trackIndex) => {
            const hasSolo = tracks.some(t => t.isSolo);
            const isTrackDimmed = track.isMuted || (hasSolo && !track.isSolo);

            return (
              <div 
                key={track.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  height: '45px', 
                  borderBottom: '1px solid #222', 
                  position: 'relative',
                  opacity: isTrackDimmed ? 0.35 : 1.0, 
                  transition: 'opacity 0.2s ease'
                }}
              >
                <div style={{ 
                  width: '180px', height: '100%', backgroundColor: '#111', borderRight: '1px solid #333', 
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px',
                  gap: '4px', zIndex: 110, position: 'sticky', left: 0
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                    <span 
                      onDoubleClick={() => {
                        const newName = prompt("ENTER NEW TRACK NAME:", track.name);
                        if (newName && newName.trim() !== "") updateTrack(track.id, { name: newName.toUpperCase() });
                      }}
                      style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px', cursor: 'text' }}
                      title="Double click to rename"
                    >
                      {trackIndex + 1}. {track.name || `STREAM ${trackIndex + 1}`}
                    </span>
                    {tracks.length > 1 && (
                      <span 
                        onClick={() => handleDeleteTrack(track.id, trackIndex)} 
                        style={{ color: '#ff4444', cursor: 'pointer', fontSize: '9px', padding: '2px 4px' }}
                      >
                        [X]
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button 
                      onClick={() => {
                        toggleTrackMute(track.id);
                        setTimeout(() => engine.updateMixer(), 0);
                      }}
                      style={{
                        padding: '2px 5px', fontSize: '8px', fontWeight: 'bold', border: '1px solid #fff',
                        backgroundColor: track.isMuted ? '#ff4444' : '#000',
                        color: track.isMuted ? '#000' : '#fff', cursor: 'pointer'
                      }}
                    >
                      M
                    </button>
                    <button 
                      onClick={() => {
                        toggleTrackSolo(track.id);
                        setTimeout(() => engine.updateMixer(), 0);
                      }}
                      style={{
                        padding: '2px 5px', fontSize: '8px', fontWeight: 'bold', border: '1px solid #fff',
                        backgroundColor: track.isSolo ? '#ffce32' : '#000',
                        color: track.isSolo ? '#000' : '#fff', cursor: 'pointer'
                      }}
                    >
                      S
                    </button>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={track.volume ?? 1.0}
                      onChange={(e) => {
                        setTrackVolume(track.id, e.target.value);
                        engine.updateTrackVolumeNode(track.id, useAppStore.getState().tracks);
                      }}
                      style={{ width: '60px', accentColor: '#fff', height: '4px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '8px', color: '#888', minWidth: '18px', textAlign: 'right' }}>
                      {Math.round((track.volume ?? 1.0) * 100)}%
                    </span>
                  </div>
                </div>

                <div 
                  onMouseDown={(e) => handleTrackLaneClick(e, track.id)}
                  style={{ 
                    flex: 1, 
                    height: '100%', 
                    position: 'relative', 
                    cursor: 'cell',
                    backgroundSize: `${4 * timelineZoom}px 100%, ${snapGrid * timelineZoom}px 100%`,
                    backgroundImage: `
                      linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
                      linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px)
                    `
                  }}
                >
                  {blocks
                    .filter(b => b.trackId === track.id)
                    .map((block) => {
                      const width = block.durationBeats * timelineZoom;
                      const left = block.startBeat * timelineZoom;
                      const isSelected = block.id === activeBlockId;
                      const inst = instruments.find(i => i.id === block.instrumentId) || instruments[0];
                      const instColor = inst.color || '#fff'; 

                      return (
                        <div
                          key={block.id}
                          onMouseDown={(e) => handleBlockMouseDown(e, block)} 
                          onClick={() => setActiveBlockId(block.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.confirm("ARE YOU SURE YOU WANT TO DELETE THIS CADRE?")) {
                              engine.stopSequencer(); 
                              deleteBlock(block.id);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            left: `${left}px`,
                            width: `${width}px`,
                            height: '35px',
                            top: '5px',
                            border: isSelected ? '2px solid #fff' : `1px solid ${instColor}`,
                            backgroundColor: isSelected ? instColor : `${instColor}25`,
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
                            zIndex: 6,
                            opacity: isTrackDimmed ? 0.25 : 1.0, 
                            transition: 'opacity 0.2s ease, background-color 0.2s'
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
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Timeline;