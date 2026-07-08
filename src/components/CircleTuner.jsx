import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getPointOnCircle, getScaleNotesForEdo } from '../utils/mathUtils';
import { engine } from '../audio/AudioEngine';

const CircleTuner = () => {
  const { edo, currentScale, snapshots, activeSnapshotId, toggleNoteInActiveSnapshot } = useAppStore();

  const size = 320;
  const radius = 120;
  const center = size / 2;

  // Находим текущий активный кадр
  const currentSnap = useMemo(() => {
    return snapshots.find(s => s.id === activeSnapshotId) || { layers: {} };
  }, [snapshots, activeSnapshotId]);

  // Все активные ноты текущей сцены (для отрисовки многоугольников)
  const allActiveNotes = useMemo(() => {
    return Object.values(currentSnap.layers).flat();
  }, [currentSnap]);

  const allowedNotes = useMemo(() => {
    return getScaleNotesForEdo(currentScale, edo);
  }, [currentScale, edo]);

  const nodes = useMemo(() => {
    const points = [];
    for (let i = 0; i < edo; i++) {
      points.push({ index: i, ...getPointOnCircle(i, edo, radius, center) });
    }
    return points;
  }, [edo]);

  const polygonString = allActiveNotes
    .map(index => `${nodes[index]?.x || 0},${nodes[index]?.y || 0}`)
    .join(' ');

  const handleNodeClick = async (index) => {
    await engine.init();
    engine.playNote(index);
    setTimeout(() => engine.stopNote(index), 300); // Кратковременный звук при клике
    toggleNoteInActiveSnapshot(index);
  };

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <circle cx={center} cy={center} r={radius} stroke="#333" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />

      {allActiveNotes.length > 1 && (
        <polygon points={polygonString} fill="none" stroke="#fff" strokeWidth="1.5" />
      )}

      {nodes.map((node) => {
        const isActive = allActiveNotes.includes(node.index);
        const isAllowed = allowedNotes.includes(node.index);

        return (
          <g 
            key={node.index} 
            onClick={() => isAllowed && handleNodeClick(node.index)} 
            style={{ cursor: isAllowed ? 'pointer' : 'not-allowed', opacity: isAllowed ? 1 : 0.15 }}
          >
            <circle cx={node.x} cy={node.y} r={10} fill="transparent" />
            <circle cx={node.x} cy={node.y} r={isActive ? 5 : 2} fill="#fff" />
            {isActive && (
              <text
                x={node.x + (node.x > center ? 14 : -14)}
                y={node.y + (node.y > center ? 14 : -14)}
                fill="#fff"
                fontSize="11"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {node.index}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default CircleTuner;