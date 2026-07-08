import React, { useEffect, useRef, useState } from 'react';
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
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    window.addEventListener('contextmenu', preventContextMenu);
    return () => window.removeEventListener('contextmenu', preventContextMenu);
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000', padding: '10px', overflow: 'hidden' }}>
      
      <KeyboardController />

      <div className="daw-header-toolbar">
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', letterSpacing: '1px' }}>MICROTONAL_DAW</h1>
            <div style={{ marginTop: '2px' }}><MidiController /></div>
          </div>
          
          <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid #333', paddingLeft: '15px' }}>
            <button className="ut-btn" onClick={handleNewProject}>NEW</button>
            <button className="ut-btn" onClick={handleSaveProject} style={{ borderColor: '#59DC90', color: '#59DC90', padding: '4px 10px', fontSize: '10px' }}>SAVE</button>
            <button className="ut-btn" onClick={() => fileInputRef.current?.click()} style={{ borderColor: '#7FFDEB', color: '#7FFDEB', padding: '4px 10px', fontSize: '10px' }}>LOAD</button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLoadProject} 
              accept=".json" 
              style={{ display: 'none' }} 
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

          <button 
            className="ut-btn"
            onClick={() => setShowHelp(true)}
            style={{ borderColor: '#FFCE32', color: '#ffce32', padding: '3px 12px', fontSize: '9px' }}
          >
            [ HELP / INFO ]
          </button>

          <button 
            className={`ut-btn ${showCircleLabels ? 'active' : ''}`}
            onClick={() => setShowCircleLabels(!showCircleLabels)}
            style={{ padding: '3px 8px', fontSize: '9px', borderColor: '#7FFDEB', color: showCircleLabels ? '#000' : '#7FFDEB' }}
          >
            LABELS: {showCircleLabels ? 'ON' : 'OFF'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', width: '70px' }}>
            <label style={{ fontSize: '9px', color: '#888', marginBottom: '1px' }}>EDO: {edo}</label>
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

          <div style={{ display: 'flex', flexDirection: 'column', width: '60px' }}>
            <label style={{ fontSize: '9px', color: '#888', marginBottom: '1px' }}>VOLUME</label>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ accentColor: '#fff' }} />
          </div>
          
        </div>
      </div>

      <div className="daw-workspace-upper">
        
        <div className="daw-circle-box">
          <CircleTuner />
          <div style={{ marginTop: '5px', width: '100%', display: 'flex', justifyContent: 'center', flexShrink: 0 }}><Visualizer /></div>
        </div>
        
        <div className="daw-hex-box">
          <HexGrid />
        </div>

      </div>

      <div className="daw-bottom-rack">
        <div style={{ width: '280px', flexShrink: 0, height: '100%' }}>
          <SynthControls />
        </div>
        <Timeline />
      </div>

      {showHelp && (
        <div 
          onClick={() => setShowHelp(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 9999, padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              border: '3px solid #fff', backgroundColor: '#000', padding: '25px',
              maxWidth: '650px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
              fontFamily: 'monospace', color: '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #fff', paddingBottom: '10px', marginBottom: '15px' }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFCE32' }}>[ MICROTONAL_DAW HELP CENTER ]</span>
              <button className="ut-btn" style={{ padding: '2px 8px', fontSize: '9px' }} onClick={() => setShowHelp(false)}>X CLOSE</button>
            </div>

            <div style={{ fontSize: '11px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div>
                <span style={{ color: '#59DC90', fontWeight: 'bold' }}>◆ ТАЙМЛАЙН И ПОТОКИ (STREAMS):</span>
                <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                  <li><b>Клик левой кнопкой на пустом месте:</b> Создает новый кадр (cadre) в месте клика с привязкой к сетке.</li>
                  <li><b>Клик левой кнопкой на блок:</b> Выделяет кадр для редактирования нот и ADSR.</li>
                  <li><b>Клик по пустому месту таймлайна (когда выбран кадр):</b> Снимает фокус / сбрасывает выделение.</li>
                  <li><b>Зажать и тащить блок:</b> Свободное перемещение во времени и между дорожками (смена инструментов!).</li>
                  <li><b>Потянуть правый край блока:</b> Изменение длительности кадра с шагом привязки до 1/32 доли.</li>
                  <li><b>Клик правой кнопкой мыши по блоку:</b> Мгновенное удаление кадра.</li>
                </ul>
              </div>

              <div>
                <span style={{ color: '#ED6ED8', fontWeight: 'bold' }}>◆ ГЕОМЕТРИЧЕСКИЙ КРУГ И СЕТКА СОТ (HEXES):</span>
                <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                  <li><b>Левый клик по кругу или сотам:</b> Добавляет/удаляет ноту в выбранный кадр (рисует неоновые полигоны).</li>
                  <li><b>Правый клик по кругу или сотам:</b> Назначает нажатую ноту тональным центром (Root) выбранного кадра.</li>
                  <li><b>11 орбит круга:</b> Представляют собой концентрический многооктавный радар (от Octave 0 до Octave 10).</li>
                  <li><b>Октавный сдвиг (OCT SHIFT):</b> Сдвигает диапазон клавиатуры сот от суб-басов C0 до писков B10.</li>
                </ul>
              </div>

              <div>
                <span style={{ color: '#7FFDEB', fontWeight: 'bold' }}>◆ ГОРЯЧИЕ КЛАВИШИ (HOTKEYS):</span>
                <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                  <li><kbd style={{ background: '#222', padding: '1px 4px', border: '1px solid #666' }}>Space</kbd> : Запуск / Пауза воспроизведения.</li>
                  <li><kbd style={{ background: '#222', padding: '1px 4px', border: '1px solid #666' }}>Esc</kbd> : Быстро снять фокус с кадра.</li>
                  <li><kbd style={{ background: '#222', padding: '1px 4px', border: '1px solid #666' }}>Ctrl + D</kbd> : Продублировать выделенный кадр встык.</li>
                  <li><b>Двойной клик на STOP (■):</b> Panic-кнопка. Полный сброс и мгновенная аппаратная тишина.</li>
                  <li><b>Ряды клавиш ПК (Z X C..., A S D..., Q W E...):</b> Микротональное playable-пианино.</li>
                </ul>
              </div>

              <div style={{ borderTop: '1px solid #333', paddingTop: '10px', textAlign: 'center', color: '#ffce32' }}>
                [ CLICK ANYWHERE OUTSIDE OR PRESS 'CLOSE' TO GO BACK ]
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;