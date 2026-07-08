import React, { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { engine } from '../audio/AudioEngine';

const SynthControls = () => {
  const { instruments, activeBlockId, blocks, updateBlock, updateInstrument } = useAppStore();

  const activeBlock = useMemo(() => {
    return blocks.find(b => b.id === activeBlockId);
  }, [blocks, activeBlockId]);

  const inst = useMemo(() => {
    if (!activeBlock) return null;
    return instruments.find(i => i.id === activeBlock.instrumentId);
  }, [activeBlock, instruments]);

  useEffect(() => {
    engine.syncInstruments();
  }, [instruments]);

  if (!activeBlock || !inst) {
    return (
      <div style={{ border: '2px solid #333', padding: '15px', backgroundColor: '#000', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '11px', textAlign: 'center' }}>
        [ CHOOSE ANY CADRE ON TIMELINE TO CONFIGURE ITS INSTRUMENT ]
      </div>
    );
  }

  const handleParamChange = (key, value) => {
    updateInstrument(inst.id, { [key]: value });
  };

  return (
    <div style={{ border: '2px solid #fff', padding: '10px 12px', backgroundColor: '#000', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
      
      <div style={{ fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #fff', paddingBottom: '3px', color: inst.color }}>
        SYNTH CONTROL: {inst.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        
        {/* WAVE SELECT */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', color: '#888' }}>WAVE TYPE:</span>
          <select 
            className="ut-select" 
            style={{ borderColor: inst.color, padding: '1px 3px', fontSize: '9px' }}
            value={activeBlock.instrumentId} 
            onChange={(e) => updateBlock(activeBlock.id, { instrumentId: e.target.value })}
          >
            <option value="triangle">TRIANGLE (Mellow)</option>
            <option value="saw">SAW (Aggressive)</option>
            <option value="square">SQUARE (Retro)</option>
            <option value="sine">SINE (Sub Bass)</option>
          </select>
        </div>

        {/* COMPACT ADSR */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', margin: '2px 0' }}>
          
          <div className="vertical-slider-container">
            <span style={{ fontSize: '8px', color: '#888' }}>A</span>
            <input 
              type="range" 
              className="vertical-slider" 
              style={{ accentColor: inst.color, height: '65px', margin: '2px 0' }} 
              min="0" max="5940" 
              value={inst.attack} 
              onChange={(e) => handleParamChange('attack', Number(e.target.value))} 
            />
            <input 
              type="number" 
              style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '8px', textAlign: 'center', padding: 0 }}
              value={inst.attack}
              onChange={(e) => handleParamChange('attack', Math.min(5940, Math.max(0, Number(e.target.value))))}
            />
          </div>

          <div className="vertical-slider-container">
            <span style={{ fontSize: '8px', color: '#888' }}>D</span>
            <input 
              type="range" 
              className="vertical-slider" 
              style={{ accentColor: inst.color, height: '65px', margin: '2px 0' }}
              min="0" max="5940" 
              value={inst.decay} 
              onChange={(e) => handleParamChange('decay', Number(e.target.value))} 
            />
            <input 
              type="number" 
              style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '8px', textAlign: 'center', padding: 0 }}
              value={inst.decay}
              onChange={(e) => handleParamChange('decay', Math.min(5940, Math.max(0, Number(e.target.value))))}
            />
          </div>

          <div className="vertical-slider-container">
            <span style={{ fontSize: '8px', color: '#888' }}>S</span>
            <input 
              type="range" 
              className="vertical-slider" 
              style={{ accentColor: inst.color, height: '65px', margin: '2px 0' }}
              min="0" max="127" 
              value={inst.sustain} 
              onChange={(e) => handleParamChange('sustain', Number(e.target.value))} 
            />
            <input 
              type="number" 
              style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '8px', textAlign: 'center', padding: 0 }}
              value={inst.sustain}
              onChange={(e) => handleParamChange('sustain', Math.min(127, Math.max(0, Number(e.target.value))))}
            />
          </div>

          <div className="vertical-slider-container">
            <span style={{ fontSize: '8px', color: '#888' }}>R</span>
            <input 
              type="range" 
              className="vertical-slider" 
              style={{ accentColor: inst.color, height: '65px', margin: '2px 0' }}
              min="0" max="5940" 
              value={inst.release} 
              onChange={(e) => handleParamChange('release', Number(e.target.value))} 
            />
            <input 
              type="number" 
              style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '8px', textAlign: 'center', padding: 0 }}
              value={inst.release}
              onChange={(e) => handleParamChange('release', Math.min(5940, Math.max(0, Number(e.target.value))))}
            />
          </div>

        </div>

        {/* ЧИСЛОВОЙ ВВОД ДЛЯ ЭФФЕКТОВ REVERB И DELAY (Пункт 2) */}
        <div style={{ borderTop: '1px solid #222', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          
          {/* REVERB */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '8px', color: '#888' }}>REVERB (%):</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="range" 
                min="0" max="1" step="0.05" 
                style={{ width: '80px', accentColor: inst.color, height: '10px' }}
                value={inst.reverb} 
                onChange={(e) => handleParamChange('reverb', Number(e.target.value))} 
              />
              <input 
                type="number" min="0" max="100"
                style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '8px', textAlign: 'center' }}
                value={Math.round((inst.reverb ?? 0.2) * 100)}
                onChange={(e) => handleParamChange('reverb', Math.min(100, Math.max(0, Number(e.target.value))) / 100)}
              />
            </div>
          </div>

          {/* DELAY */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '8px', color: '#888' }}>DELAY (%):</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="range" 
                min="0" max="1" step="0.05" 
                style={{ width: '80px', accentColor: inst.color, height: '10px' }}
                value={inst.delay} 
                onChange={(e) => handleParamChange('delay', Number(e.target.value))} 
              />
              <input 
                type="number" min="0" max="100"
                style={{ width: '35px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '8px', textAlign: 'center' }}
                value={Math.round((inst.delay ?? 0.1) * 100)}
                onChange={(e) => handleParamChange('delay', Math.min(100, Math.max(0, Number(e.target.value))) / 100)}
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SynthControls;