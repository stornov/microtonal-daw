import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const CircleTuner = () => {
  const edo = useAppStore(state => state.edo);
  const blocks = useAppStore(state => state.blocks);
  const activeBlockId = useAppStore(state => state.activeBlockId);
  const toggleNoteInActiveBlock = useAppStore(state => state.toggleNoteInActiveBlock);
  const updateBlock = useAppStore(state => state.updateBlock);
  const isPlaying = useAppStore(state => state.isPlaying);
  const instruments = useAppStore(state => state.instruments);
  const showCircleLabels = useAppStore(state => state.showCircleLabels);
  const setShowCircleLabels = useAppStore(state => state.setShowCircleLabels);
  const circleZoom = useAppStore(state => state.circleZoom);
  const setCircleZoom = useAppStore(state => state.setCircleZoom);
  const liveKeypresses = useAppStore(state => state.liveKeypresses);
  const currentInstrumentId = useAppStore(state => state.currentInstrumentId);
  const liveActiveNotes = useAppStore(state => state.liveActiveNotes);

  const size = 500; 
  const center = size / 2;
  const baseRadius = 120; 
  const orbitSpacing = 12; 

  const containerRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    if (circleZoom === 1.0) {
      setPan({ x: 0, y: 0 });
    }
  }, [circleZoom]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleNativeWheel = (e) => {
      e.preventDefault(); 
      const zoomFactor = 0.15;
      const currentZoom = useAppStore.getState().circleZoom;
      
      const newZoom = e.deltaY < 0 
        ? Math.min(2.5, currentZoom + zoomFactor) 
        : Math.max(1.0, currentZoom - zoomFactor);
      
      setCircleZoom(newZoom);
    };

    element.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleNativeWheel);
    };
  }, [setCircleZoom]);

  const activeBlock = useMemo(() => {
    return blocks.find(b => b.id === activeBlockId);
  }, [blocks, activeBlockId]);

  const activeBlockInstrument = useMemo(() => {
    if (!activeBlock) return null;
    return instruments.find(i => i.id === blockActiveInstrumentId(activeBlock));
  }, [activeBlock, instruments]);

  function blockActiveInstrumentId(b) {
    return b.instrumentId || 'triangle';
  }

  const currentNotes = useMemo(() => {
    return activeBlock?.notes || [];
  }, [activeBlock]);

  const getNoteCoordinates = (index, totalPoints) => {
    const angle = ((index % totalPoints) + totalPoints) % totalPoints * (2 * Math.PI) / totalPoints - Math.PI / 2;
    const octaveOffset = Math.floor(index / totalPoints); 
    const dynamicRadius = baseRadius + octaveOffset * orbitSpacing; 
    
    return {
      x: center + dynamicRadius * Math.cos(angle),
      y: center + dynamicRadius * Math.sin(angle),
      radius: dynamicRadius,
      angle
    };
  };

  const octaveOffsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

  const allInteractiveNodes = useMemo(() => {
    const points = [];
    
    octaveOffsets.forEach((octOffset) => {
      for (let i = 0; i < edo; i++) {
        const angle = (i * 2 * Math.PI) / edo - Math.PI / 2;
        const radius = baseRadius + octOffset * orbitSpacing;
        const absoluteNoteIndex = i + octOffset * orbitSpacing; 
        const actualNoteIndex = i + octOffset * edo;

        if (actualNoteIndex < -96 || absoluteNoteIndex > 186) {
          continue; 
        }

        points.push({
          index: actualNoteIndex,
          chromaticIndex: i,
          octave: octOffset + 4,
          octOffset,
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
          radius,
          angle
        });
      }
    });
    return points;
  }, [edo, baseRadius, center]);

  const polygonString = useMemo(() => {
    return currentNotes
      .map(noteIndex => {
        const coords = getNoteCoordinates(noteIndex, edo);
        return `${coords.x},${coords.y}`;
      })
      .join(' ');
  }, [currentNotes, edo]);

  const handleNodeClick = async (noteIndex) => {
    await engine.init();
    engine.playNote(noteIndex);
    setTimeout(() => engine.stopNote(noteIndex), 350);
    toggleNoteInActiveBlock(noteIndex); 
  };

  const handleRightClick = (e, noteIndex) => {
    e.preventDefault(); 
    if (!activeBlock) return;
    const targetFreq = 261.63 * Math.pow(2, noteIndex / edo);
    updateBlock(activeBlock.id, { baseFreq: targetFreq });
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
      return;
    }

    if (circleZoom <= 1.0) return;
    if (e.button === 0 || e.button === 1) {
      isDragging.current = true;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y
      };
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: dragStart.current.panX + dx,
      y: dragStart.current.panY + dy
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        width: '100%', 
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        cursor: circleZoom > 1.0 ? (isDragging.current ? 'grabbing' : 'grab') : 'default'
      }}
    >
      
      <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#888', zIndex: 30, fontWeight: 'bold' }} onMouseDown={e => e.stopPropagation()}>
        <span>ZOOM:</span>
        <input 
          type="range" min="1" max="2.5" step="0.1" 
          style={{ width: '80px', accentColor: '#fff', cursor: 'pointer' }}
          value={circleZoom} onChange={(e) => setCircleZoom(e.target.value)} 
        />
        <input 
            type="number" min="1.0" max="2.5" step="0.1"
            style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
            value={circleZoom.toFixed(1)} 
            onChange={(e) => setCircleZoom(Math.min(2.5, Math.max(1.0, parseFloat(e.target.value) || 1.0)))} 
        />
      </div>

      <button 
        className="ut-btn"
        onClick={() => setShowCircleLabels(!showCircleLabels)}
        style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px', 
          fontSize: '11px', 
          padding: '6px 12px', 
          border: '2px solid #7FFDEB', 
          backgroundColor: showCircleLabels ? '#7FFDEB' : '#000',
          color: showCircleLabels ? '#000' : '#7FFDEB',
          zIndex: 30,
          cursor: 'pointer'
        }}
      >
        LABELS: {showCircleLabels ? 'ON' : 'OFF'}
      </button>

      <div style={{ 
        width: '100%', 
        height: '100%',
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${circleZoom})`,
        transformOrigin: 'center center',
        pointerEvents: 'auto',
        minHeight: 0
      }}>
        <svg 
          viewBox="0 0 500 500" 
          style={{ width: '100%', height: '100%', maxHeight: '100%', maxWidth: '100%', overflow: 'visible' }} 
        >
          
          {octaveOffsets.map(octOffset => {
            const radius = baseRadius + octOffset * orbitSpacing;
            const isBase = octOffset === 0;
            return (
              <circle
                key={octOffset}
                cx={center}
                cy={center}
                r={radius}
                stroke={isBase ? "#ffffff" : "rgba(255,255,255,0.45)"}
                strokeWidth={isBase ? 1.8 : 1.0}
                fill="none"
                strokeDasharray={isBase ? "none" : "2 3"} 
              />
            );
          })}

          {isPlaying ? (
            Object.entries(liveActiveNotes).map(([blockId, item]) => {
              if (!item || !item.notes || item.notes.length <= 1) return null;
              
              const uniqueLiveNotes = [...new Set(item.notes)];
              if (uniqueLiveNotes.length <= 1) return null;

              const pointsStr = uniqueLiveNotes
                .map(index => {
                  const coords = getNoteCoordinates(index, edo);
                  return `${coords.x},${coords.y}`;
                })
                .join(' ');
                
              return (
                <polygon
                  key={blockId}
                  points={pointsStr}
                  fill={`${item.color}15`} 
                  stroke={item.color}      
                  strokeWidth="2"
                />
              );
            })
          ) : (
            currentNotes.length > 1 && (
              <polygon
                points={polygonString}
                fill={`${activeBlockInstrument?.color || '#ffffff'}15`}
                stroke={activeBlockInstrument?.color || '#ffffff'}
                strokeWidth="2"
              />
            )
          )}

          {allInteractiveNodes.map((node) => {
            const liveColors = Object.values(liveActiveNotes)
              .filter(item => item && item.notes.includes(node.index))
              .map(item => item.color);

            const isKeyPressed = (liveKeypresses || []).includes(node.index);
            const activeInstrument = instruments.find(i => i.id === currentInstrumentId);

            const isLiveActive = liveColors.length > 0 || isKeyPressed;
            const isEditActive = currentNotes.includes(node.index);

            let dotColor = 'rgba(255,255,255,0.45)'; 
            let dotRadius = 1.8;

            if (isPlaying && liveColors.length > 0) {
              dotColor = liveColors[0]; 
              dotRadius = 4.8; 
            } else if (isKeyPressed) {
              dotColor = activeInstrument ? activeInstrument.color : '#fff';
              dotRadius = 4.5; 
            } else if (!isPlaying && isEditActive) {
              dotColor = activeBlockInstrument?.color || '#ffaa00'; 
              dotRadius = 3.8; 
            } else if (node.octOffset === 0) {
              dotColor = 'rgba(255,255,255,0.75)'; 
              dotRadius = 2.5;                     
            }

            const textOffset = node.octOffset >= 0 ? 12 : -12;
            const textRadius = node.radius + textOffset;
            const textX = center + textRadius * Math.cos(node.angle);
            const textY = center + textRadius * Math.sin(node.angle);

            const labelOpacity = (isLiveActive || isEditActive) ? 1 : 0;

            return (
              <g 
                key={`${node.octave}-${node.chromaticIndex}`} 
                onClick={() => handleNodeClick(node.index)} 
                onContextMenu={(e) => handleRightClick(e, node.index)} 
                style={{ cursor: 'pointer' }}
              >
                <circle cx={node.x} cy={node.y} r={8} fill="transparent" />
                <circle cx={node.x} cy={node.y} r={dotRadius} fill={dotColor} />
                
                {showCircleLabels && (
                  <text
                    x={textX}
                    y={textY}
                    fill="#fff"
                    fontSize="7.5px"
                    fontWeight="bold"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    className="fade-text"
                    style={{ 
                      pointerEvents: 'none',
                      opacity: labelOpacity,
                      transition: 'opacity 1s ease-out' 
                    }}
                  >
                    {node.chromaticIndex}
                  </text>
                )}
              </g>
            );
          })}

        </svg>
      </div>
    </div>
  );
};

export default CircleTuner;