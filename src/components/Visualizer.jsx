import React, { useRef, useEffect } from 'react';
import { engine } from '../audio/AudioEngine';
import { useAppStore } from '../store/useAppStore';

const Visualizer = () => {
  const waveCanvasRef = useRef(null);
  const phaseCanvasRef = useRef(null);
  
  const { visGain, setVisGain, visLineWidth, setVisLineWidth, visDecay, setVisDecay } = useAppStore();

  useEffect(() => {
    const waveCanvas = waveCanvasRef.current;
    const phaseCanvas = phaseCanvasRef.current;
    if (!waveCanvas || !phaseCanvas) return;

    const waveCtx = waveCanvas.getContext('2d');
    const phaseCtx = phaseCanvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    const waveWidth = 280;
    const waveHeight = 80;
    const phaseWidth = 80;
    const phaseHeight = 80;

    waveCanvas.width = waveWidth * dpr;
    waveCanvas.height = waveHeight * dpr;
    waveCanvas.style.width = `${waveWidth}px`;
    waveCanvas.style.height = `${waveHeight}px`;
    waveCtx.scale(dpr, dpr);

    phaseCanvas.width = phaseWidth * dpr;
    phaseCanvas.height = phaseHeight * dpr;
    phaseCanvas.style.width = `${phaseWidth}px`;
    phaseCanvas.style.height = `${phaseHeight}px`;
    phaseCtx.scale(dpr, dpr);

    let animationFrameId;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      
      if (document.hidden) return;

      const state = useAppStore.getState();
      const currentDecay = state.visDecay;
      const currentGain = state.visGain;
      const currentLineWidth = state.visLineWidth;

      if (currentDecay >= 1.0) {
        waveCtx.clearRect(0, 0, waveWidth, waveHeight);
        phaseCtx.clearRect(0, 0, phaseWidth, phaseHeight);
      } else {
        waveCtx.fillStyle = `rgba(0, 0, 0, ${currentDecay})`;
        waveCtx.fillRect(0, 0, waveWidth, waveHeight);

        phaseCtx.fillStyle = `rgba(0, 0, 0, ${currentDecay})`;
        phaseCtx.fillRect(0, 0, phaseWidth, phaseHeight);
      }

      const waveform = engine.getWaveformData();
      if (!waveform) return;

      waveCtx.lineWidth = currentLineWidth;
      waveCtx.strokeStyle = '#ffffff'; 
      waveCtx.beginPath();
      
      const sliceWidth = waveWidth / waveform.length;
      let x = 0;
      
      for (let i = 0; i < waveform.length; i++) {
        const y = (waveform[i] * currentGain + 0.5) * waveHeight;
        if (i === 0) waveCtx.moveTo(x, y);
        else waveCtx.lineTo(x, y);
        x += sliceWidth;
      }
      waveCtx.stroke();

      phaseCtx.fillStyle = '#ffffff'; 
      const delay = 15; 
      
      for (let i = 0; i < waveform.length - delay; i += 2) {
        const px = (waveform[i] * currentGain + 0.5) * phaseWidth;
        const py = (waveform[i + delay] * currentGain + 0.5) * phaseHeight;
        
        phaseCtx.fillRect(px, py, 2, 2);
      }
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <canvas ref={phaseCanvasRef} className="daw-canvas-faded" style={{ border: '1px solid #111' }} />
        <canvas ref={waveCanvasRef} className="daw-canvas-faded" style={{ border: '1px solid #111' }} />
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '11px', color: '#888', borderTop: '1px solid #111', paddingTop: '10px', justifyContent: 'center', width: '100%' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold' }}>AMP:</span>
          <input type="range" min="0.1" max="1.5" step="0.05" style={{ width: '60px', accentColor: '#fff', cursor: 'pointer' }} value={visGain} onChange={e => setVisGain(e.target.value)} />
          <input 
            type="number" min="0.1" max="1.5" step="0.1"
            style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
            value={visGain.toFixed(1)} 
            onChange={(e) => setVisGain(Math.min(1.5, Math.max(0.1, parseFloat(e.target.value) || 0.1)))} 
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold' }}>LINE:</span>
          <input type="range" min="0.5" max="3" step="0.1" style={{ width: '60px', accentColor: '#fff', cursor: 'pointer' }} value={visLineWidth} onChange={e => setVisLineWidth(e.target.value)} />
          <input 
            type="number" min="0.5" max="3" step="0.1"
            style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
            value={visLineWidth.toFixed(1)} 
            onChange={(e) => setVisLineWidth(Math.min(3, Math.max(0.5, parseFloat(e.target.value) || 1.0)))} 
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold' }}>TRAIL:</span>
          <input type="range" min="0.05" max="1" step="0.05" style={{ width: '60px', accentColor: '#fff', cursor: 'pointer' }} value={visDecay} onChange={e => setVisDecay(e.target.value)} />
          <input 
            type="number" min="0" max="100" step="5"
            style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '11px', textAlign: 'center', padding: '2px' }}
            value={Math.round((1 - visDecay) * 100)} 
            onChange={(e) => setVisDecay(1 - (Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) / 100))} 
          />
          <span>%</span>
        </div>

      </div>
    </div>
  );
};

export default Visualizer;