// Расчет частоты для любого индекса (включая отрицательные)
export const getFrequency = (noteIndex, edo, baseFreq) => {
  return baseFreq * Math.pow(2, noteIndex / edo);
};

// Координаты круга
export const getPointOnCircle = (index, totalPoints, radius, center) => {
  const angle = (index * 2 * Math.PI) / totalPoints - Math.PI / 2;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
};

export const NOTE_NAMES_31 = [
  "C", "C#", "C#", "Db", "Db", "D", "D#", "D#", "Eb", "Eb", "E", "E#", "Fb", "F", "F#", "F#",
  "Gb", "Gb", "G", "G#", "G#", "Ab", "Ab", "A", "A#", "A#", "Bb", "Bb", "B", "B#", "Cb"
];

// --- МНОГООКТАВНОЕ ИМЯ НОТЫ (Пункт 5) ---
export const getNoteName31 = (noteIndex) => {
  const edo = 31;
  // Обрабатываем отрицательные индексы (низкие ноты) математически правильно
  const wrappedIndex = ((noteIndex % edo) + edo) % edo;
  
  // Базовая октава C4 находится на шаге 0
  const octave = Math.floor(noteIndex / edo) + 4; 
  return `${NOTE_NAMES_31[wrappedIndex]}${octave}`;
};

export const formatBeatsToFraction = (beats) => {
  const thirtySeconds = Math.round(beats / 0.125);
  if (thirtySeconds === 32) return "1/1";
  if (thirtySeconds === 16) return "1/2";
  if (thirtySeconds === 8) return "1/4";
  if (thirtySeconds === 4) return "1/8";
  if (thirtySeconds === 2) return "1/16";
  if (thirtySeconds === 1) return "1/32";

  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(thirtySeconds, 32);
  const num = thirtySeconds / divisor;
  const den = 32 / divisor;
  return `${num}/${den}`;
};

export const getScaleNotesForEdo = (scaleType, EDO) => {
  if (scaleType === 'chromatic') {
    return Array.from({ length: EDO }, (_, i) => i);
  }

  const scaleCents = {
    major: [0, 200, 400, 500, 700, 900, 1100],
    minor: [0, 200, 300, 500, 700, 800, 1000],
    pentatonic: [0, 200, 400, 700, 900],
    just_major: [0, 203.9, 386.3, 498.0, 702.0, 884.4, 1088.3]
  }[scaleType];

  if (!scaleCents) return [];

  const allowedSteps = scaleCents.map(cents => Math.round((cents / 1200) * EDO));
  return [...new Set(allowedSteps)].sort((a, b) => a - b);
};

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

// Константы долей
export const SUBDIVISIONS = {
  '1+/1': 6.0,
  '1/1': 4.0,
  '1/2': 2.0,
  '1/4': 1.0,
  '1/8': 0.5,
  '1/16': 0.25,
  '1/32': 0.125
};