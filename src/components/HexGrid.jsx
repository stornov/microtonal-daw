import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const HexGrid = () => {
  const { edo, snapshots, activeSnapshotId, toggleNoteInActiveSnapshot } = useAppStore();

  const hexSize = 15;
  const hexWidth = Math.sqrt(3) * hexSize;
  const hexHeight = 2 * hexSize;
  
  const rows = 10;
  const cols = 12;

  const currentSnap = useMemo(() => {
    return snapshots.find(s => s.id === activeSnapshotId) || { layers: {} };
  }, [snapshots, activeSnapshotId]);

  const allActiveNotes = useMemo(() => {
    return Object.values(currentSnap.layers).flat();
  }, [currentSnap]);

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
        let noteIndex = (q * 5 + r * 2) % edo;
        nodes.push({ r, q, x, y, noteIndex });
      }
    }
    return nodes;
  }, [rows, cols, hexWidth, hexHeight, edo]);

  const handleHexClick = async (index) => {
    await engine.init();
    engine.playNote(index);
    setTimeout(() => engine.stopNote(index), 300);
    toggleNoteInActiveSnapshot(index);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={cols * hexWidth + hexWidth} height={rows * hexHeight * 0.75 + hexHeight}>
        {gridNodes.map((node) => {
          const isActive = allActiveNotes.includes(node.noteIndex);
          return (
            <g 
              key={`${node.r}-${node.q}`} 
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => handleHexClick(node.noteIndex)}
              style={{ cursor: 'pointer' }}
            >
              <polygon
                points={hexPolygonCoords}
                fill={isActive ? '#fff' : '#000'}
                stroke={isActive ? '#fff' : '#222'}
                strokeWidth="1"
              />
              <text
                x="0" y="1"
                fill={isActive ? '#000' : '#444'}
                fontSize="9"
                textAnchor="middle" alignmentBaseline="middle"
                pointerEvents="none"
              >
                {node.noteIndex}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default HexGrid;