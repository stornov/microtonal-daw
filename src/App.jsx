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
import { bufferToWav, getFrequency } from './utils/mathUtils';
import * as Tone from 'tone';

function App() {
  const { edo, setEdo, volume, setVolume, currentScale, setCurrentScale, tempo, instruments, blocks, isPlaying, newProject, loadProject, showCircleLabels, setShowCircleLabels, isExporting, setIsExporting } = useAppStore();
  const fileInputRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);
  
  const [showExportModal, setShowExportSettingsOpen] = useState(false);
  const [exportMode, setExportMode] = useState('leave'); 

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

  const getExportDurations = () => {
    let maxBeats = 4.0;
    blocks.forEach(b => {
      const end = b.startBeat + b.durationBeats;
      if (end > maxBeats) maxBeats = end;
    });

    const beatDurationSec = 60 / tempo;
    const totalDurationSec = maxBeats * beatDurationSec;

    let maxTailSeconds = 1.0;
    const usedInstrumentIds = [...new Set(blocks.map(b => b.instrumentId))];
    usedInstrumentIds.forEach(id => {
      const inst = instruments.find(i => i.id === id);
      if (inst) {
        const releaseSec = inst.r_disabled ? 0.1 : (inst.release / 1000);
        const reverbTail = inst.reverb ? (inst.reverb * 4.0) : 0;
        const delayTail = inst.delay ? (inst.delay * 3.0) : 0;
        const instTotalTail = releaseSec + reverbTail + delayTail;
        if (instTotalTail > maxTailSeconds) {
          maxTailSeconds = instTotalTail;
        }
      }
    });

    const tailDurationSec = Math.max(0.5, Math.min(6.0, maxTailSeconds));
    return {
      timelineSec: totalDurationSec,
      tailSec: tailDurationSec
    };
  };

  const trimSilence = (audioBuffer) => {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    let endFrame = length - 1;
    const threshold = 0.00005; 

    for (let i = length - 1; i >= 0; i--) {
      let hasSignal = false;
      for (let channel = 0; channel < numChannels; channel++) {
        const data = audioBuffer.getChannelData(channel);
        if (Math.abs(data[i]) > threshold) {
          hasSignal = true;
          break;
        }
      }
      if (hasSignal) {
        endFrame = i;
        break;
      }
    }

    if (endFrame === length - 1) return audioBuffer;

    const marginFrames = Math.floor(sampleRate * 0.1); 
    const finalEndFrame = Math.min(length, endFrame + marginFrames);

    const croppedBuffer = Tone.context.createBuffer(
      numChannels,
      finalEndFrame,
      sampleRate
    );

    for (let channel = 0; channel < numChannels; channel++) {
      const srcData = audioBuffer.getChannelData(channel);
      const dstData = croppedBuffer.getChannelData(channel);
      for (let i = 0; i < finalEndFrame; i++) {
        dstData[i] = srcData[i];
      }
    }

    return croppedBuffer;
  };

  const handleExecuteExport = async () => {
    setShowExportSettingsOpen(false);
    await engine.init();
    setIsExporting(true);

    const { timelineSec } = getExportDurations();
    const renderDurationSec = exportMode === 'leave' ? (timelineSec + 6.0) : timelineSec;

    const beatDurationSec = 60 / tempo;
    const currentEdo = edo;
    const currentBaseFreq = useAppStore.getState().baseFreq;

    try {
      let buffer = await Tone.Offline(async (context) => {
        const limiter = new Tone.Limiter(-1).toDestination();
        const offlineSynths = {};

        for (const inst of instruments) {
          const synth = new Tone.PolySynth(Tone.Synth, { volume: -15 });
          const delay = new Tone.FeedbackDelay("8n", 0.4);
          const reverb = new Tone.Freeverb({ roomSize: 0.6, dampening: 2000 });

          synth.chain(delay, reverb, limiter);

          const attackSec = inst.a_disabled ? 0.01 : inst.attack / 1000;
          const decaySec = inst.d_disabled ? 0.1 : inst.decay / 1000;
          const sustainVal = inst.s_disabled ? 1.0 : inst.sustain / 127;
          const releaseSec = inst.r_disabled ? 0.1 : inst.release / 1000;

          synth.set({
            oscillator: { type: inst.waveType },
            envelope: { attack: attackSec, decay: decaySec, sustain: sustainVal, release: releaseSec }
          });

          reverb.wet.value = inst.reverb ?? 0.2;
          delay.wet.value = inst.delay ?? 0.1;

          offlineSynths[inst.id] = synth;
        }

        blocks.forEach((block) => {
          const startSeconds = block.startBeat * beatDurationSec;
          const durSeconds = block.durationBeats * beatDurationSec;
          const synth = offlineSynths[block.instrumentId];

          if (synth && block.notes.length > 0) {
            const blockBaseFreq = block.baseFreq || 261.63;
            const freqs = block.notes.map(n => getFrequency(n, currentEdo, blockBaseFreq));
            const vel = (block.velocity !== undefined ? block.velocity : 100) / 127;
            
            synth.triggerAttackRelease(freqs, durSeconds, startSeconds, vel);
          }
        });

      }, renderDurationSec);

      if (exportMode === 'leave') {
        buffer = trimSilence(buffer);
      }

      const wavBlob = bufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      const anchor = document.createElement("a");
      anchor.download = `microtonal_render_${exportMode === 'leave' ? 'full' : 'loop'}.wav`;
      anchor.href = url;
      anchor.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("RENDER FAILED: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const { timelineSec, tailSec } = getExportDurations();

  return (
    <div className="daw-app-container">
      
      <KeyboardController />

      <div className="daw-header-toolbar" style={{ display: 'grid', gridTemplateColumns: '1.2fr auto 1.3fr', alignItems: 'center', border: '2px solid #fff', padding: '10px 20px', marginBottom: '10px', flexShrink: 0, gap: '20px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '2px', fontWeight: 'bold' }}>MICROTONAL_DAW</h1>
          <MidiController />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={handleNewProject}>NEW</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px', borderColor: '#ffce32', color: '#ffce32' }} onClick={handleSaveProject}>SAVE JSON</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px', borderColor: '#7FFDEB', color: '#7FFDEB' }} onClick={() => fileInputRef.current?.click()}>LOAD JSON</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 14px', borderColor: '#59DC90', color: '#59DC90' }} onClick={() => setShowExportSettingsOpen(true)}>💾 RENDER WAV</button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLoadProject} 
            accept=".json" 
            style={{ display: 'none' }} 
          />
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'flex-end' }}>

          <button 
            className={`ut-btn ${showCircleLabels ? 'active' : ''}`}
            onClick={() => setShowCircleLabels(!showCircleLabels)}
            style={{ padding: '5px 10px', fontSize: '10px', borderColor: '#7FFDEB', color: showCircleLabels ? '#000' : '#7FFDEB' }}
          >
            LABELS: {showCircleLabels ? 'ON' : 'OFF'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
            <label style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>EDO: {edo}</label>
            <input type="range" min="5" max="72" value={edo} onChange={(e) => setEdo(Number(e.target.value))} style={{ accentColor: '#fff' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ fontSize: '9px', color: '#888' }}>SCALE:</label>
            <select className="ut-select" style={{ fontSize: '11px', padding: '2px 6px' }} value={currentScale} onChange={(e) => setCurrentScale(e.target.value)}>
              <option value="chromatic">CHROMATIC</option>
              <option value="major">MAJOR</option>
              <option value="minor">MINOR</option>
              <option value="pentatonic">PENTATONIC</option>
              <option value="just_major">JUST MAJOR</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '70px' }}>
            <label style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>MASTER VOL</label>
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

      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, fontFamily: 'monospace' }}>
          <div style={{ border: '3px solid #fff', padding: '35px', backgroundColor: '#000', maxWidth: '650px', width: '90%', color: '#fff' }}>
            <h2 style={{ fontSize: '20px', color: '#ffce32', borderBottom: '2px solid #fff', paddingBottom: '12px', margin: '0 0 20px 0', letterSpacing: '1px' }}>[ WAV EXPORT CONTROL ]</h2>
            
            <p style={{ fontSize: '14px', color: '#ccc', margin: '0 0 20px 0', lineHeight: '1.6' }}>
              Your project duration is <span style={{ color: '#fff', fontWeight: 'bold' }}>{timelineSec.toFixed(2)}s</span> based on {tempo} BPM. Choose how the DAW should handle the rendering process:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', cursor: 'pointer', fontSize: '14px' }}>
                <input 
                  type="radio" 
                  name="exportMode" 
                  value="leave" 
                  checked={exportMode === 'leave'} 
                  onChange={() => setExportMode('leave')} 
                  style={{ accentColor: '#ffce32', cursor: 'pointer', transform: 'scale(1.2)', marginTop: '4px' }}
                />
                <div>
                  <span style={{ fontWeight: 'bold', color: '#59DC90', fontSize: '16px' }}>LEAVE REMAINDER (Lush Tail)</span>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '5px', lineHeight: '1.4' }}>
                    Renders the full track. The system dynamically crops trailing silent space, preserving the exact duration of the fade-out.
                  </div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', cursor: 'pointer', fontSize: '14px', borderTop: '2px solid #222', paddingTop: '15px' }}>
                <input 
                  type="radio" 
                  name="exportMode" 
                  value="cut" 
                  checked={exportMode === 'cut'} 
                  onChange={() => setExportMode('cut')} 
                  style={{ accentColor: '#ffce32', cursor: 'pointer', transform: 'scale(1.2)', marginTop: '4px' }}
                />
                <div>
                  <span style={{ fontWeight: 'bold', color: '#ff4444', fontSize: '16px' }}>CUT REMAINDER (Seamless Loop)</span>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '5px', lineHeight: '1.4' }}>
                    Cuts the render exactly at {timelineSec.toFixed(2)}s. Perfect for loop-samples, rhythm loops, and repeating patterns.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button className="ut-btn" style={{ borderColor: '#59DC90', color: '#59DC90', fontSize: '13px', padding: '8px 20px' }} onClick={handleExecuteExport}>START RENDER</button>
              <button className="ut-btn" style={{ borderColor: '#888', color: '#888', fontSize: '13px', padding: '8px 20px' }} onClick={() => setShowExportSettingsOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {isExporting && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          backgroundColor: 'rgba(0, 0, 0, 0.95)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 99999, fontFamily: 'monospace' 
        }}>
          <div style={{ border: '3px solid #fff', padding: '50px', textAlign: 'center', backgroundColor: '#000', maxWidth: '600px', width: '90%' }}>
            <h2 style={{ fontSize: '22px', color: '#ffce32', margin: '0 0 20px 0', letterSpacing: '1px' }}>[ RENDERING MASTER STEMS ]</h2>
            <p style={{ fontSize: '14px', color: '#ccc', lineHeight: '1.6', margin: 0 }}>
              COMPUTING HIGH-FIDELITY OFFLINE BUFFER IN {exportMode.toUpperCase()} MODE... PLEASE WAIT...
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;