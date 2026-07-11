import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const CircleTuner = () => {
  const edo = useAppStore(state => state.edo);
  const activeBlockId = useAppStore(state => state.activeBlockId);
  
  const currentNotesStr = useAppStore(state => {
    const b = state.blocks.find(x => x.id === state.activeBlockId);
    return b ? b.notes.join(',') : '';
  });
  const currentNotes = useMemo(() => currentNotesStr ? currentNotesStr.split(',').map(Number) : [], [currentNotesStr]);

  const activeInstColor = useAppStore(state => {
    const b = state.blocks.find(x => x.id === state.activeBlockId);
    if (!b) return '#fff';
    const inst = state.instruments.find(i => i.id === b.instrumentId);
    return inst?.color || '#fff';
  });

  const toggleNoteInActiveBlock = useAppStore(state => state.toggleNoteInActiveBlock);
  const updateBlock = useAppStore(state => state.updateBlock);
  const isPlaying = useAppStore(state => state.isPlaying);
  const showCircleLabels = useAppStore(state => state.showCircleLabels);
  const setShowCircleLabels = useAppStore(state => state.setShowCircleLabels);
  const circleZoom = useAppStore(state => state.circleZoom);
  const setCircleZoom = useAppStore(state => state.setCircleZoom);
  const liveKeypresses = useAppStore(state => state.liveKeypresses);
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
    if (circleZoom === 1.0) setPan({ x: 0, y: 0 });
  }, [circleZoom]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleNativeWheel = (e) => {
      e.preventDefault(); 
      const zoomFactor = 0.15;
      const currentZoom = useAppStore.getState().circleZoom;
      setCircleZoom(e.deltaY < 0 ? Math.min(2.5, currentZoom + zoomFactor) : Math.max(1.0, currentZoom - zoomFactor));
    };
    element.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleNativeWheel);
  }, [setCircleZoom]);

  const getNoteCoordinates = (index, totalPoints) => {
    const angle = ((index % totalPoints) + totalPoints) % totalPoints * (2 * Math.PI) / totalPoints - Math.PI / 2;
    const octaveOffset = Math.floor(index / totalPoints); 
    const dynamicRadius = baseRadius + octaveOffset * orbitSpacing; 
    return { x: center + dynamicRadius * Math.cos(angle), y: center + dynamicRadius * Math.sin(angle), radius: dynamicRadius, angle };
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
        if (actualNoteIndex < -96 || absoluteNoteIndex > 186) continue; 
        points.push({ index: actualNoteIndex, chromaticIndex: i, octave: octOffset + 4, octOffset, x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle), radius, angle });
      }
    });
    return points;
  }, [edo, baseRadius, center]);

  const polygonString = useMemo(() => {
    return currentNotes.map(n => {
      const c = getNoteCoordinates(n, edo);
      return `${c.x},${c.y}`;
    }).join(' ');
  }, [currentNotes, edo]);

  const handleNodeClick = async (noteIndex) => {
    await engine.init();
    engine.playNote(noteIndex);
    setTimeout(() => engine.stopNote(noteIndex), 350);
    toggleNoteInActiveBlock(noteIndex); 
  };

  const handleRightClick = (e, noteIndex) => {
    e.preventDefault(); 
    if (!activeBlockId) return;
    const targetFreq = 261.63 * Math.pow(2, noteIndex / edo);
    updateBlock(activeBlockId, { baseFreq: targetFreq });
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    if (circleZoom <= 1.0) return;
    if (e.button === 0 || e.button === 1) {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    setPan({ x: dragStart.current.panX + e.clientX - dragStart.current.x, y: dragStart.current.panY + e.clientY - dragStart.current.y });
  };

  return (
    <div ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => isDragging.current = false} onMouseLeave={() => isDragging.current = false} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: circleZoom > 1.0 ? (isDragging.current ? 'grabbing' : 'grab') : 'default' }}>
      <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#888', zIndex: 30, fontWeight: 'bold' }} onMouseDown={e => e.stopPropagation()}>
        <span>ZOOM:</span>
        <input type="range" min="1" max="2.5" step="0.1" style={{ width: '80px', accentColor: '#fff', cursor: 'pointer' }} value={circleZoom} onChange={(e) => setCircleZoom(e.target.value)} />
        <input type="number" min="1.0" max="2.5" step="0.1" style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }} value={circleZoom.toFixed(1)} onChange={(e) => setCircleZoom(Math.min(2.5, Math.max(1.0, parseFloat(e.target.value) || 1.0)))} />
      </div>
      <button className="ut-btn" onClick={() => setShowCircleLabels(!showCircleLabels)} style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '11px', padding: '6px 12px', border: '2px solid #7FFDEB', backgroundColor: showCircleLabels ? '#7FFDEB' : '#000', color: showCircleLabels ? '#000' : '#7FFDEB', zIndex: 30, cursor: 'pointer' }}>LABELS: {showCircleLabels ? 'ON' : 'OFF'}</button>

      <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translate(${pan.x}px, ${pan.y}px) scale(${circleZoom})`, transformOrigin: 'center center', pointerEvents: 'auto', minHeight: 0 }}>
        <svg viewBox="0 0 500 500" style={{ width: '100%', height: '100%', maxHeight: '100%', maxWidth: '100%', overflow: 'visible' }}>
          {octaveOffsets.map(octOffset => <circle key={octOffset} cx={center} cy={center} r={baseRadius + octOffset * orbitSpacing} stroke={octOffset === 0 ? "#ffffff" : "rgba(255,255,255,0.45)"} strokeWidth={octOffset === 0 ? 1.8 : 1.0} fill="none" strokeDasharray={octOffset === 0 ? "none" : "2 3"} />)}

          {isPlaying ? (
            Object.entries(liveActiveNotes).map(([blockId, item]) => {
              if (!item || !item.notes || item.notes.length <= 1) return null;
              const uniqueLiveNotes = [...new Set(item.notes)];
              if (uniqueLiveNotes.length <= 1) return null;
              const pointsStr = uniqueLiveNotes.map(index => `${getNoteCoordinates(index, edo).x},${getNoteCoordinates(index, edo).y}`).join(' ');
              return <polygon key={blockId} points={pointsStr} fill={`${item.color}15`} stroke={item.color} strokeWidth="2" />;
            })
          ) : (
            currentNotes.length > 1 && <polygon points={polygonString} fill={`${activeInstColor}15`} stroke={activeInstColor} strokeWidth="2" />
          )}

          {allInteractiveNodes.map((node) => {
            const liveColors = Object.values(liveActiveNotes).filter(item => item && item.notes.includes(node.index)).map(item => item.color);
            const isKeyPressed = liveKeypresses.includes(node.index);
            const isLiveActive = liveColors.length > 0 || isKeyPressed;
            const isEditActive = currentNotes.includes(node.index);

            let dotColor = 'rgba(255,255,255,0.45)'; let dotRadius = 1.8;
            if (isPlaying && liveColors.length > 0) dotRadius = 4.8; 
            else if (isKeyPressed) { dotColor = activeInstColor; dotRadius = 4.5; } 
            else if (!isPlaying && isEditActive) { dotColor = activeInstColor; dotRadius = 3.8; } 
            else if (node.octOffset === 0) { dotColor = 'rgba(255,255,255,0.75)'; dotRadius = 2.5; }

            const textOffset = node.octOffset >= 0 ? 12 : -12;
            const labelOpacity = (isLiveActive || isEditActive) ? 1 : 0;
            const uniqueLiveColors = [...new Set(liveColors)];

            return (
              <g key={`${node.octave}-${node.chromaticIndex}`} onClick={() => handleNodeClick(node.index)} onContextMenu={(e) => handleRightClick(e, node.index)} style={{ cursor: 'pointer' }}>
                <circle cx={node.x} cy={node.y} r={8} fill="transparent" />
                {isPlaying && uniqueLiveColors.length > 0 ? uniqueLiveColors.map((color, idx) => <circle key={idx} cx={node.x} cy={node.y} r={4.8 - idx * 1.2} fill={color} />) : <circle cx={node.x} cy={node.y} r={dotRadius} fill={dotColor} />}
                {showCircleLabels && <text x={center + (node.radius + textOffset) * Math.cos(node.angle)} y={center + (node.radius + textOffset) * Math.sin(node.angle)} fill="#fff" fontSize="7.5px" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" className="fade-text" style={{ pointerEvents: 'none', opacity: labelOpacity, transition: 'opacity 1s ease-out' }}>{node.chromaticIndex}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default CircleTuner;