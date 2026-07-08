import React, { useRef, useEffect } from 'react';
import { engine } from '../audio/AudioEngine';

const Visualizer = () => {
  const waveCanvasRef = useRef(null);
  const phaseCanvasRef = useRef(null);

  useEffect(() => {
    const waveCtx = waveCanvasRef.current.getContext('2d');
    const phaseCtx = phaseCanvasRef.current.getContext('2d');
    let animationFrameId;

    const draw = () => {
      // Зацикливаем функцию (вызывается 60 раз в секунду)
      animationFrameId = requestAnimationFrame(draw);

      const waveCanvas = waveCanvasRef.current;
      const phaseCanvas = phaseCanvasRef.current;

      // Очищаем оба канваса перед новым кадром
      waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
      phaseCtx.clearRect(0, 0, phaseCanvas.width, phaseCanvas.height);

      // Получаем данные волны (Float32Array) из нашего движка
      const waveform = engine.getWaveformData();
      if (!waveform) return;

      // === 1. РИСУЕМ ОСЦИЛЛОГРАФ (Правый канвас) ===
      waveCtx.lineWidth = 2;
      waveCtx.strokeStyle = '#fff';
      waveCtx.beginPath();
      
      const sliceWidth = waveCanvas.width / waveform.length;
      let x = 0;
      
      for (let i = 0; i < waveform.length; i++) {
        // waveform[i] лежит в пределах [-1, 1]. Масштабируем, чтобы влезло в высоту канваса
        const y = (waveform[i] * 0.4 + 0.5) * waveCanvas.height;
        
        if (i === 0) waveCtx.moveTo(x, y);
        else waveCtx.lineTo(x, y);
        
        x += sliceWidth;
      }
      waveCtx.stroke();

      // === 2. РИСУЕМ ФАЗОВЫЙ ПОРТРЕТ (Левый канвас) ===
      // Рисуем амплитуду сигнала относительно немного сдвинутой копии этого же сигнала
      phaseCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const delay = 15; // Сдвиг (влияет на форму клубка)
      
      for (let i = 0; i < waveform.length - delay; i++) {
        const px = (waveform[i] * 0.4 + 0.5) * phaseCanvas.width;
        const py = (waveform[i + delay] * 0.4 + 0.5) * phaseCanvas.height;
        phaseCtx.fillRect(px, py, 1.5, 1.5); // Рисуем маленькие точки
      }
    };

    draw();

    // Очистка при размонтировании компонента
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div style={{ display: 'flex', gap: '30px', marginTop: '30px', alignItems: 'center' }}>
      {/* Левый экран: Фигуры Лиссажу (хаотичное облако) */}
      <canvas ref={phaseCanvasRef} width={80} height={80} />
      
      {/* Правый экран: Классическая волна */}
      <canvas ref={waveCanvasRef} width={300} height={80} />
    </div>
  );
};

export default Visualizer;