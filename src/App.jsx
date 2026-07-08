import React, { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from './store/useAppStore';
import { engine } from './audio/AudioEngine';
import { generateAllNotes } from './utils/mathUtils';
import CircleTuner from './components/CircleTuner';
import Visualizer from './components/Visualizer';
import KeyboardController from './components/KeyboardController';
import HexGrid from './components/HexGrid';
import MidiController from './components/MidiController';
import Timeline from './components/Timeline'; // <-- Новый Таймлайн

function App() {
  const { edo, setEdo, baseFreq, setBaseFreq, volume, setVolume, currentScale, setCurrentScale, tempo, setTempo, instruments, currentInstrumentId, setCurrentInstrument, getActiveNotesForRender } = useAppStore();

  const allNotes = useMemo(() => generateAllNotes(), []);

  // Синхронизация звуков
  useEffect(() => { engine.stopAll(); }, [edo]);
  useEffect(() => { engine.stopAll(); }, [baseFreq]);
  useEffect(() => { engine.updateVolume(volume); }, [volume]);
  useEffect(() => { engine.syncInstruments(); }, [instruments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000', padding: '20px' }}>
      
      {/* Фоновый клавиатурный контроллер */}
      <KeyboardController />

      {/* ШАПКА В СТИЛЕ РЕТРО / UNDERTALE */}
      <div style={{ 
        border: '2px solid #fff', 
        padding: '15px 20px', 
        marginBottom: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '20px' 
      }}>
        
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', letterSpacing: '1px' }}>MICROTONAL_OS</h1>
          <div style={{ marginTop: '5px' }}><MidiController /></div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: '#888' }}>EDIT_LAYER:</label>
            <select className="ut-select" style={{ borderColor: '#ffaa00', color: '#ffaa00' }} value={currentInstrumentId} onChange={(e) => setCurrentInstrument(e.target.value)}>
              {instruments.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
            <label style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>BPM: {tempo}</label>
            <input type="range" min="60" max="240" value={tempo} onChange={(e) => setTempo(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
            <label style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>EDO: {edo}</label>
            <input type="range" min="5" max="72" value={edo} onChange={(e) => setEdo(Number(e.target.value))} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ fontSize: '11px', color: '#888' }}>SCALE:</label>
            <select className="ut-select" value={currentScale} onChange={(e) => setCurrentScale(e.target.value)}>
              <option value="chromatic">CHROMATIC</option>
              <option value="major">MAJOR</option>
              <option value="minor">MINOR</option>
              <option value="pentatonic">PENTATONIC</option>
              <option value="just_major">JUST MAJOR</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ fontSize: '11px', color: '#888' }}>ROOT:</label>
            <select className="ut-select" value={baseFreq} onChange={(e) => setBaseFreq(e.target.value)}>
              {allNotes.map((note) => <option key={note.name} value={note.freq}>{note.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '70px' }}>
            <label style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>VOLUME</label>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          </div>
          
        </div>
      </div>

      {/* ГЛАВНАЯ РАБОЧАЯ ЗОНА */}
      <div style={{ display: 'flex', flex: 1, gap: '20px', overflow: 'hidden', marginBottom: '20px' }}>
        
        {/* Левая панель: Круг и Осциллограф */}
        <div style={{ flex: 1, border: '2px solid #fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', position: 'relative' }}>
          <div style={{ transform: 'scale(1.1)' }}>
            <CircleTuner />
          </div>
          <div style={{ marginTop: '10px' }}>
            <Visualizer />
          </div>
        </div>
        
        {/* Правая панель: Изоморфная сетка */}
        <div style={{ flex: 1.3, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
          <HexGrid />
        </div>

      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ: ТАЙМЛАЙН ГЕОМЕТРИЧЕСКИХ КАДРОВ */}
      <Timeline />

    </div>
  );
}

export default App;