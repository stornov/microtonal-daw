import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';
import { getNoteName31 } from '../utils/mathUtils';

const HexGrid = () => {
  const edo = useAppStore(state => state.edo);
  const blocks = useAppStore(state => state.blocks);
  const activeBlockId = useAppStore(state => state.activeBlockId);
  const toggleNoteInActiveBlock = useAppStore(state => state.toggleNoteInActiveBlock);
  const updateBlock = useAppStore(state => state.updateBlock);
  const isPlaying = useAppStore(state => state.isPlaying);
  const instruments = useAppStore(state => state.instruments);
  const hexOctaveShift = useAppStore(state => state.hexOctaveShift);
  const setHexOctaveShift = useAppStore(state => state.setHexOctaveShift);
  const liveActiveNotes = useAppStore(state => state.liveActiveNotes); 

  const hexSize = 27; 
  const hexWidth = Math.sqrt(3) * hexSize;
  const hexHeight = 2 * hexSize;
  
  const rows = 9;
  const cols = 11;

  const activeBlock = useMemo(() => {
    return blocks.find(b => b.id === activeBlockId);
  }, [blocks, activeBlockId]);

  const currentNotes = activeBlock ? activeBlock.notes : [];

  function blockActiveInstrumentId(b) {
    return b.instrumentId || 'triangle';
  }

  const hexPolygonCoords = useMemo(() => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle_rad = Math.PI / 180 * (60 * i - 30);
      points.push(`${hexSize * Math.cos(angle_rad)},${hexSize * Math.sin(angle_rad)}`);
    }
    return points.join(' ');
  }, [hexSize]);

  const gridNodes = useMemo(() => {
    const nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const xOffset = (r % 2 === 0) ? 0 : hexWidth / 2;
        const x = q * hexWidth + xOffset + hexWidth;
        const y = r * (hexHeight * 0.75) + hexHeight;
        
        let noteIndex = (q * 5 + r * 2) - 34; 
        noteIndex += hexOctaveShift * edo;

        if (noteIndex < -96 || noteIndex > 186) {
          continue; 
        }

        nodes.push({ r, q, x, y, noteIndex });
      }
    }
    return nodes;
  }, [rows, cols, hexWidth, hexHeight, hexOctaveShift, edo]);

  const totalSvgWidth = useMemo(() => {
    return cols * hexWidth + hexWidth;
  }, [cols, hexWidth]);

  const totalSvgHeight = useMemo(() => {
    return rows * (hexHeight * 0.75) + hexHeight;
  }, [rows, hexHeight]);

  const activeRangeText = useMemo(() => {
    if (gridNodes.length === 0) return 'OUT OF RANGE';
    const minNote = gridNodes[0].noteIndex;
    const maxNote = gridNodes[gridNodes.length - 1].noteIndex;
    return `${getNoteName31(minNote)} - ${getNoteName31(maxNote)}`;
  }, [gridNodes]);

  const handleHexClick = async (index) => {
    await engine.init();
    engine.playNote(index);
    setTimeout(() => engine.stopNote(index), 350);
    toggleNoteInActiveBlock(index);
  };

  const handleRightClick = (e, index) => {
    e.preventDefault(); 
    if (!activeBlock) return;
    const targetFreq = 261.63 * Math.pow(2, index / edo);
    updateBlock(activeBlock.id, { baseFreq: targetFreq });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', justifyContent: 'space-between', padding: '10px 0', overflow: 'hidden' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '1px solid #222', width: '95%', paddingBottom: '8px', flexShrink: 0 }}>
        
        <div></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'center' }}>
          <button 
            className="ut-btn" 
            onClick={() => setHexOctaveShift(Math.max(-4, hexOctaveShift - 1))}
            disabled={hexOctaveShift <= -4} 
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            ◀ OCT DOWN
          </button>

          <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: '#ffce32', minWidth: '150px', textAlign: 'center' }}>
            OCT SHIFT: {hexOctaveShift > 0 ? `+${hexOctaveShift}` : hexOctaveShift} ({activeRangeText})
          </span>

          <button 
            className="ut-btn" 
            onClick={() => setHexOctaveShift(Math.min(6, hexOctaveShift + 1))}
            disabled={hexOctaveShift >= 6} 
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            OCT UP ▶
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
          {activeBlockId && activeBlock && (
            <>
              <span style={{ fontSize: '12px', color: '#ffce32', fontWeight: 'bold' }}>
                ROOT: {activeBlock.baseFreq.toFixed(1)}Hz
              </span>
              <button 
                className="ut-btn" 
                style={{ fontSize: '11px', padding: '6px 12px', borderColor: '#444' }} 
                onClick={() => updateBlock(activeBlockId, { baseFreq: 261.63 })}
              >
                RESET ROOT
              </button>
            </>
          )}
        </div>
        
      </div>

      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', overflow: 'hidden', minHeight: 0 }}>
        <svg 
          viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
          style={{ width: '100%', height: 'auto', maxWidth: `${totalSvgWidth}px`, maxHeight: '100%', overflow: 'visible' }}
        >
          {gridNodes.map((node) => {
            const liveColors = Object.values(liveActiveNotes)
              .filter(item => item && item.notes.includes(node.noteIndex))
              .map(item => item.color);

            const isKeyPressed = useAppStore.getState().liveKeypresses.includes(node.noteIndex);
            const activeInstrument = instruments.find(i => i.id === useAppStore.getState().currentInstrumentId);

            const isLiveActive = liveColors.length > 0 || isKeyPressed;
            const isEditActive = currentNotes.includes(node.noteIndex);

            let fillColor = '#000';
            let strokeColor = '#222';
            let textStyleColor = '#555';

            if (isLiveActive) {
              fillColor = '#fff';
              strokeColor = '#fff';
              textStyleColor = '#000';
            } else if (isEditActive) {
              fillColor = '#111';
              strokeColor = '#fff';
              textStyleColor = '#fff';
            }

            return (
              <g 
                key={`${node.r}-${node.q}`} 
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => handleHexClick(node.noteIndex)}
                onContextMenu={(e) => handleRightClick(e, node.noteIndex)}
                style={{ 
                  cursor: 'pointer',
                  opacity: 1 
                }}
              >
                <polygon
                  className={`hex-polygon ${isLiveActive ? 'active' : ''}`}
                  points={hexPolygonCoords}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
                <text
                  x="0" y="-5"
                  fill={textStyleColor}
                  fontSize="10px"
                  fontWeight="bold"
                  fontFamily="inherit"
                  textAnchor="middle" alignmentBaseline="middle"
                  pointerEvents="none"
                >
                  {getNoteName31(node.noteIndex)}
                </text>
                <text
                  x="0" y="8"
                  fill={textStyleColor}
                  fontSize="8px"
                  fontFamily="inherit"
                  textAnchor="middle" alignmentBaseline="middle"
                  pointerEvents="none"
                  opacity="0.5"
                >
                  {node.noteIndex}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

    </div>
  );
};

export default HexGrid;