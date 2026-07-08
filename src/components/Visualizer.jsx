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
      animationFrameId = requestAnimationFrame(draw);

      const waveCanvas = waveCanvasRef.current;
      const phaseCanvas = phaseCanvasRef.current;

      waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
      phaseCtx.clearRect(0, 0, phaseCanvas.width, phaseCanvas.height);

      const waveform = engine.getWaveformData();
      if (!waveform) return;

      waveCtx.lineWidth = 2;
      waveCtx.strokeStyle = '#fff';
      waveCtx.beginPath();
      
      const sliceWidth = waveCanvas.width / waveform.length;
      let x = 0;
      
      for (let i = 0; i < waveform.length; i++) {
        const y = (waveform[i] * 0.4 + 0.5) * waveCanvas.height;
        
        if (i === 0) waveCtx.moveTo(x, y);
        else waveCtx.lineTo(x, y);
        
        x += sliceWidth;
      }
      waveCtx.stroke();

      phaseCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const delay = 15;
      
      for (let i = 0; i < waveform.length - delay; i++) {
        const px = (waveform[i] * 0.4 + 0.5) * phaseCanvas.width;
        const py = (waveform[i + delay] * 0.4 + 0.5) * phaseCanvas.height;
        phaseCtx.fillRect(px, py, 1.5, 1.5);
      }
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div style={{ display: 'flex', gap: '30px', marginTop: '30px', alignItems: 'center' }}>
      <canvas ref={phaseCanvasRef} width={80} height={80} />
      
      <canvas ref={waveCanvasRef} width={300} height={80} />
    </div>
  );
};

export default Visualizer;