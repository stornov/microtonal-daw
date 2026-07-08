// Расчет частоты ноты
export const getFrequency = (noteIndex, edo, baseFreq) => {
  return baseFreq * Math.pow(2, noteIndex / edo);
};

// Расчет координат точки на круге
export const getPointOnCircle = (index, totalPoints, radius, center) => {
  const angle = (index * 2 * Math.PI) / totalPoints - Math.PI / 2;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
};

// Генерация списка нот от C0 до B10
export const generateAllNotes = () => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const notes = [];
  for (let midi = 12; midi <= 131; midi++) {
    const octave = Math.floor(midi / 12) - 1;
    const nameIndex = midi % 12;
    const name = `${noteNames[nameIndex]}${octave}`;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    notes.push({ name, freq });
  }
  return notes;
};

// --- НОВОЕ: РАСЧЕТ РАЗРЕШЕННЫХ НОТ ДЛЯ ЛАДОВ ---
export const getScaleNotesForEdo = (scaleType, EDO) => {
  if (scaleType === 'chromatic') {
    // Возвращаем все ноты
    return Array.from({ length: EDO }, (_, i) => i);
  }

  // Центы для разных ладов
  const scaleCents = {
    major: [0, 200, 400, 500, 700, 900, 1100],            // Темперированный Мажор
    minor: [0, 200, 300, 500, 700, 800, 1000],           // Темперированный Минор
    pentatonic: [0, 200, 400, 700, 900],                 // Пентатоника
    just_major: [0, 203.9, 386.3, 498.0, 702.0, 884.4, 1088.3] // Чистый строй (Just Intonation 5-limit)
  }[scaleType];

  if (!scaleCents) return [];

  // Переводим центы в шаги текущего EDO по формуле
  const allowedSteps = scaleCents.map(cents => Math.round((cents / 1200) * EDO));
  
  // Убираем дубликаты (актуально для маленьких EDO, например 5 EDO)
  return [...new Set(allowedSteps)].sort((a, b) => a - b);
};