import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const CircleTuner = () => {
  const { edo, blocks, activeBlockId, toggleNoteInActiveBlock, updateBlock, isPlaying, instruments, currentPlayheadBeat, showCircleLabels } = useAppStore();

  const size = 500; 
  const center = size / 2;
  const baseRadius = 140; 

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

  // --- ЗАЩИТА: Гарантируем, что массив нот никогда не будет undefined (Пункт 1) ---
  const currentNotes = useMemo(() => {
    return activeBlock?.notes || [];
  }, [activeBlock]);

  const getNoteCoordinates = (index, totalPoints) => {
    const angle = ((index % totalPoints) + totalPoints) % totalPoints * (2 * Math.PI) / totalPoints - Math.PI / 2;
    const octaveOffset = Math.floor(index / totalPoints); 
    const dynamicRadius = baseRadius + octaveOffset * 15; 
    
    return {
      x: center + dynamicRadius * Math.cos(angle),
      y: center + dynamicRadius * Math.sin(angle),
      radius: dynamicRadius,
      angle
    };
  };

  const liveActiveNotes = useMemo(() => {
    if (!isPlaying || currentPlayheadBeat < 0) return {};
    const active = {};
    blocks.forEach((block) => {
      const endBeat = block.startBeat + block.durationBeats;
      if (currentPlayheadBeat >= block.startBeat && currentPlayheadBeat < endBeat) {
        const inst = instruments.find(i => i.id === blockActiveInstrumentId(block));
        // Защита внутри плейбека
        const safeNotes = block.notes || [];
        active[block.id] = { notes: safeNotes, color: inst ? inst.color : '#fff' };
      }
    });
    return active;
  }, [blocks, isPlaying, currentPlayheadBeat, instruments]);

  const octaveOffsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

  const allInteractiveNodes = useMemo(() => {
    const points = [];
    
    octaveOffsets.forEach((octOffset) => {
      for (let i = 0; i < edo; i++) {
        const angle = (i * 2 * Math.PI) / edo - Math.PI / 2;
        const radius = baseRadius + octOffset * 15;
        const absoluteNoteIndex = i + octOffset * edo; 

        if (absoluteNoteIndex < -96 || absoluteNoteIndex > 186) {
          continue; 
        }

        points.push({
          index: absoluteNoteIndex,
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

  return (
    <svg 
      viewBox={`0 0 ${size} ${size}`} 
      style={{ width: '100%', height: 'auto', maxHeight: '390px', overflow: 'visible' }} 
    >
      
      {/* 11 ОРБИТ КАРТЫ КООРДИНАТ */}
      {octaveOffsets.map(octOffset => {
        const radius = baseRadius + octOffset * 15;
        const isBase = octOffset === 0;
        return (
          <circle
            key={octOffset}
            cx={center}
            cy={center}
            r={radius}
            stroke={isBase ? "#ffce32" : "rgba(255,255,255,0.15)"}
            strokeWidth={isBase ? 1.6 : 0.8}
            fill="none"
            strokeDasharray={isBase ? "none" : "2 4"} 
          />
        );
      })}

      {/* ОТРИСОВКА МНОГОУГОЛЬНИКОВ */}
      {isPlaying ? (
        Object.entries(liveActiveNotes).map(([blockId, item]) => {
          if (!item || !item.notes || item.notes.length <= 1) return null;
          
          const pointsStr = item.notes
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

      {/* ОТРИСОВКА ИНТЕРАКТИВНЫХ ТОЧЕК НА ВСЕХ ОРБИТАХ */}
      {allInteractiveNodes.map((node) => {
        const liveColors = Object.values(liveActiveNotes)
          .filter(item => item && item.notes && item.notes.includes(node.index))
          .map(item => item.color);

        const isLiveActive = liveColors.length > 0;
        const isEditActive = currentNotes.includes(node.index);

        let dotColor = 'rgba(255,255,255,0.015)'; 
        let dotRadius = 1.5;

        if (isPlaying && isLiveActive) {
          dotColor = liveColors[0]; 
          dotRadius = 6.5;
        } else if (!isPlaying && isEditActive) {
          dotColor = activeBlockInstrument?.color || '#ffaa00'; 
          dotRadius = 4.5;
        } else if (node.octOffset === 0) {
          dotColor = 'rgba(255,255,255,0.12)';
          dotRadius = 2.5;
        }

        const textOffset = node.octOffset >= 0 ? 12 : -12;
        const textRadius = node.radius + textOffset;
        const textX = center + textRadius * Math.cos(node.angle);
        const textY = center + textRadius * Math.sin(node.angle);

        const isLabelVisible = showCircleLabels && (isLiveActive || isEditActive);

        return (
          <g 
            key={`${node.octave}-${node.chromaticIndex}`} 
            onClick={() => handleNodeClick(node.index)} 
            onContextMenu={(e) => handleRightClick(e, node.index)} 
            style={{ cursor: 'pointer' }}
          >
            <circle cx={node.x} cy={node.y} r={8} fill="transparent" />
            <circle cx={node.x} cy={node.y} r={dotRadius} fill={dotColor} />
            
            {isLabelVisible && (
              <text
                x={textX}
                y={textY}
                fill="#fff"
                fontSize="7.5px"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
                className="fade-text"
                style={{ pointerEvents: 'none' }}
              >
                {node.chromaticIndex}
              </text>
            )}
          </g>
        );
      })}

    </svg>
  );
};

export default CircleTuner;