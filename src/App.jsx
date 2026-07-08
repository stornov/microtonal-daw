import React, { useEffect, useRef } from 'react';
import { useAppStore } from './store/useAppStore';
import { engine } from './audio/AudioEngine';
import CircleTuner from './components/CircleTuner';
import Visualizer from './components/Visualizer';
import KeyboardController from './components/KeyboardController';
import HexGrid from './components/HexGrid';
import MidiController from './components/MidiController';
import SynthControls from './components/SynthControls';
import Timeline from './components/Timeline';

function App() {
  const { edo, setEdo, volume, setVolume, currentScale, setCurrentScale, tempo, instruments, blocks, isPlaying, newProject, loadProject, showCircleLabels, setShowCircleLabels } = useAppStore();
  const fileInputRef = useRef(null);

  // Глобальное глушение контекстного меню браузера [5]
  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    window.addEventListener('contextmenu', preventContextMenu);
    return () => window.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  // Тихий бут звука
  useEffect(() => {
    const silentBoot = async () => {
      await engine.init(); 
      window.removeEventListener('mousedown', silentBoot);
      window.removeEventListener('keydown', silentBoot);
    };
    window.addEventListener('mousedown', silentBoot);
    window.addEventListener('keydown', silentBoot);
    return () => {
      window.removeEventListener('mousedown', silentBoot);
      window.removeEventListener('keydown', silentBoot);
    };
  }, []);

  useEffect(() => {
    engine.syncTimeline(); 
  }, [blocks, tempo]);

  useEffect(() => { engine.stopAll(); }, [edo]);
  useEffect(() => { engine.updateVolume(volume); }, [volume]);
  useEffect(() => { engine.syncInstruments(); }, [instruments]);

  const handleSaveProject = () => {
    const state = useAppStore.getState();
    const projectData = {
      edo: state.edo,
      tempo: state.tempo,
      currentScale: state.currentScale,
      tracks: state.tracks,
      blocks: state.blocks,
      instruments: state.instruments,
      showCircleLabels: state.showCircleLabels
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(projectData, null, 2)
    )}`;
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'microtonal_project.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleLoadProject = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        engine.stopAllImmediate(); 
        loadProject(parsedData); 
      } catch (err) {
        alert('CRITICAL ERROR: Failed to parse microtonal project file!');
      }
    };
    fileReader.readAsText(file);
    e.target.value = null; 
  };

  const handleNewProject = () => {
    if (window.confirm('ARE YOU SURE YOU WANT TO CLEAR ALL AND START A NEW PROJECT?')) {
      engine.stopAllImmediate();
      newProject();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000', padding: '15px', overflow: 'hidden' }}>
      
      <KeyboardController />

      {/* HEADER / ТУЛБАР В СТИЛЕ UNDERTALE */}
      <div style={{ 
        border: '2px solid #fff', 
        padding: '12px 20px', 
        marginBottom: '15px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '15px' 
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '1px' }}>MICROTONAL_DAW</h1>
            <div style={{ marginTop: '5px' }}><MidiController /></div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid #333', paddingLeft: '20px' }}>
            <button className="ut-btn" onClick={handleNewProject}>NEW</button>
            <button className="ut-btn" onClick={handleSaveProject} style={{ borderColor: '#59DC90', color: '#59DC90' }}>SAVE</button>
            <button className="ut-btn" onClick={() => fileInputRef.current?.click()} style={{ borderColor: '#7FFDEB', color: '#7FFDEB' }}>LOAD</button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLoadProject} 
              accept=".json" 
              style={{ display: 'none' }} 
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>

          {/* ТУМБЛЕР ЦИФР КРУГА (Пункт 1) */}
          <button 
            className={`ut-btn ${showCircleLabels ? 'active' : ''}`}
            onClick={() => setShowCircleLabels(!showCircleLabels)}
            style={{ padding: '4px 10px', fontSize: '10px', borderColor: '#7FFDEB', color: showCircleLabels ? '#000' : '#7FFDEB' }}
          >
            LABELS: {showCircleLabels ? 'ON' : 'OFF'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
            <label style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>EDO: {edo}</label>
            <input type="range" min="5" max="72" value={edo} onChange={(e) => setEdo(Number(e.target.value))} style={{ accentColor: '#fff' }} />
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

          <div style={{ display: 'flex', flexDirection: 'column', width: '70px' }}>
            <label style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>MASTER VOL</label>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ accentColor: '#fff' }} />
          </div>
          
        </div>
      </div>

      {/* ВЕРХНЯЯ РАБОЧАЯ ЗОНА */}
      <div style={{ display: 'flex', flex: 1.6, gap: '15px', overflow: 'hidden', marginBottom: '15px', minHeight: '440px' }}>
        
        {/* Сфера визуализации */}
        <div style={{ flex: 1.1, border: '2px solid #fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', position: 'relative', padding: '10px' }}>
          <CircleTuner />
          <div style={{ marginTop: '5px', width: '100%', display: 'flex', justifyContent: 'center' }}><Visualizer /></div>
        </div>
        
        {/* Изоморфная сетка */}
        <div style={{ flex: 1.4, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', overflow: 'hidden' }}>
          <HexGrid />
        </div>

      </div>

      {/* НИЖНЯЯ РАБОЧАЯ ЗОНА */}
      <div className="daw-bottom-rack">
        <div style={{ width: '280px', flexShrink: 0, height: '100%' }}>
          <SynthControls />
        </div>
        <Timeline />
      </div>

    </div>
  );
}

export default App;