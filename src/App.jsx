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

const compressProject = async (proj) => {
  const trackIds = proj.tracks.map(t => t.id);
  const instIds = ['triangle', 'saw', 'square', 'sine'];

  const tracksArray = proj.tracks.map(t => [
    t.name, t.volume, t.isMuted ? 1 : 0, t.isSolo ? 1 : 0, t.color
  ]);

  const blocksArray = proj.blocks.map(b => {
    const tIdx = trackIds.indexOf(b.trackId);
    const iIdx = instIds.indexOf(b.instrumentId);
    return [
      tIdx !== -1 ? tIdx : 0, b.startBeat, b.durationBeats, iIdx !== -1 ? iIdx : 0,
      b.notes, Math.round(b.baseFreq * 100) / 100 === 261.63 ? 0 : Number(b.baseFreq.toFixed(2)),
      b.velocity === 100 ? 0 : b.velocity
    ];
  });

  const instParams = proj.instruments.map(i => [
    i.attack, i.decay, i.sustain, i.release, Number(i.reverb.toFixed(2)), Number(i.delay.toFixed(2)), i.color 
  ]);

  const compactData = [
    proj.edo, proj.tempo, proj.showCircleLabels ? 1 : 0, Number(proj.circleZoom.toFixed(1)), proj.hexOctaveShift, tracksArray, blocksArray, instParams 
  ];

  const jsonString = JSON.stringify(compactData);
  const stream = new Blob([jsonString]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream('deflate-raw'));
  const buffer = await new Response(compressedStream).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); 
};

const decompressProject = async (compressedData) => {
  try {
    let b64 = compressedData.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate-raw'));
    const jsonString = await new Response(decompressedStream).text();
    const raw = JSON.parse(jsonString);

    if (Array.isArray(raw)) {
      const [edo, tempo, showCircleLabels, circleZoom, hexOctaveShift, tracksArray, blocksArray, instParams] = raw;

      const tracks = tracksArray.map((tItem, idx) => {
        if (typeof tItem === 'string') return { id: `track_${idx + 1}`, name: tItem, volume: 1.0, isMuted: false, isSolo: false };
        return { id: `track_${idx + 1}`, name: tItem[0], volume: tItem[1] ?? 1.0, isMuted: tItem[2] === 1, isSolo: tItem[3] === 1 };
      });

      const instIds = ['triangle', 'saw', 'square', 'sine'];
      const instNames = ['TRIANGLE', 'SAW', 'SQUARE', 'SINE'];
      const instColors = ['#59DC90', '#ED6ED8', '#7FFDEB', '#FFCE32'];
      const waveTypes = ['triangle', 'sawtooth', 'square', 'sine'];

      const instruments = instIds.map((id, idx) => {
        const params = instParams[idx] || [100, 300, 90, 1500, 0.2, 0.1, instColors[idx]];
        return {
          id: id, name: instNames[idx], color: params[6] || instColors[idx], waveType: waveTypes[idx],
          attack: params[0], decay: params[1], sustain: params[2], release: params[3],
          reverb: params[4], delay: params[5], a_disabled: false, d_disabled: false, s_disabled: false, r_disabled: false
        };
      });

      const blocks = blocksArray.map((b, idx) => {
        const [tIdx, startBeat, durationBeats, iIdx, notes, baseFreq, velocity] = b;
        return {
          id: `block_${Date.now()}_${idx}`, trackId: tracks[tIdx]?.id || tracks[0]?.id || 'track_1',
          startBeat, durationBeats, instrumentId: instIds[iIdx] || 'triangle',
          baseFreq: baseFreq === 0 ? 261.63 : baseFreq, velocity: velocity === 0 ? 100 : velocity, notes
        };
      });

      return { edo, tempo, showCircleLabels: showCircleLabels === 1, circleZoom: circleZoom || 1.0, hexOctaveShift: hexOctaveShift || 0, tracks, blocks, instruments };
    }
    return {
      edo: raw.edo || raw.e, tempo: raw.tempo || raw.t, showCircleLabels: (raw.showCircleLabels ?? raw.cl) === 1 || (raw.showCircleLabels ?? raw.cl) === true,
      circleZoom: raw.circleZoom ?? raw.z ?? 1.0, hexOctaveShift: raw.hexOctaveShift ?? raw.os ?? 0,
      tracks: (raw.tracks ?? raw.tr)?.map(t => ({ id: t.id || t.i, name: t.name || t.n })),
      blocks: (raw.blocks ?? raw.b)?.map(b => ({ id: b.id || b.i, trackId: b.trackId || b.t, startBeat: b.startBeat ?? b.s, durationBeats: b.durationBeats ?? b.d, instrumentId: b.instrumentId || b.in, baseFreq: b.baseFreq || b.f, velocity: b.velocity ?? b.v, notes: b.notes || b.n })),
      instruments: (raw.instruments ?? raw.ins)?.map(i => ({ id: i.id || i.i, name: i.name || i.n, color: i.color || i.c, waveType: i.waveType || i.w, attack: i.attack || i.a, decay: i.decay || i.de, sustain: i.sustain || i.su, release: i.release || i.r, reverb: i.reverb ?? i.re, delay: i.delay ?? i.dy, a_disabled: i.a_disabled || i.ad === 1, d_disabled: i.d_disabled || i.dd === 1, s_disabled: i.s_disabled || i.sd === 1, r_disabled: i.r_disabled || i.rd === 1 }))
    };
  } catch (err) {
    console.error("Decompression failed:", err);
    throw err;
  }
};

function App() {
  const edo = useAppStore(state => state.edo);
  const setEdo = useAppStore(state => state.setEdo);
  const volume = useAppStore(state => state.volume);
  const setVolume = useAppStore(state => state.setVolume);
  const tempo = useAppStore(state => state.tempo);
  const setTempo = useAppStore(state => state.setTempo);
  const instruments = useAppStore(state => state.instruments);
  const updateInstrument = useAppStore(state => state.updateInstrument); 
  const newProject = useAppStore(state => state.newProject);
  const loadProject = useAppStore(state => state.loadProject);
  const showCircleLabels = useAppStore(state => state.showCircleLabels);
  const setShowCircleLabels = useAppStore(state => state.setShowCircleLabels);
  const isExporting = useAppStore(state => state.isExporting);
  const setIsExporting = useAppStore(state => state.setIsExporting);
  const circleZoom = useAppStore(state => state.circleZoom);
  const setCircleZoom = useAppStore(state => state.setCircleZoom);
  const loadDemoTrack = useAppStore(state => state.loadDemoTrack);
  const activeDemoKey = useAppStore(state => state.activeDemoKey);

  const fileInputRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showExportModal, setShowExportSettingsOpen] = useState(false);
  const [exportMode, setExportMode] = useState('leave'); 
  const [shareStatus, setShareStatus] = useState('🔗 SHARE');

  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    window.addEventListener('contextmenu', preventContextMenu);
    return () => window.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const silentBoot = async () => {
        await engine.init(); 
        window.removeEventListener('mousedown', silentBoot);
        window.removeEventListener('keydown', silentBoot);
      };
      window.addEventListener('mousedown', silentBoot);
      window.addEventListener('keydown', silentBoot);

      const hash = window.location.hash;
      if (hash && hash.startsWith('#project=')) {
        try {
          const base64Data = hash.substring('#project='.length);
          const parsedData = await decompressProject(base64Data);
          loadProject(parsedData);
          window.history.replaceState("", document.title, window.location.pathname + window.location.search);
        } catch (err) {
          console.error("Failed to load project from URL:", err);
        }
      }
    };
    initApp();
  }, [loadProject]);
  
  useEffect(() => { engine.stopAll(); }, [edo]);
  useEffect(() => { engine.updateVolume(volume); }, [volume]);

  const clearUrlHash = () => {
    if (window.location.hash) {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };

  const handleSaveProject = () => {
    const state = useAppStore.getState();
    const projectData = {
      edo: state.edo, tempo: state.tempo, tracks: state.tracks, blocks: state.blocks,
      instruments: state.instruments, showCircleLabels: state.showCircleLabels
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(projectData, null, 2))}`;
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
        clearUrlHash(); 
      } catch (err) {
        alert('CRITICAL ERROR: Failed to parse file!');
      }
    };
    fileReader.readAsText(file);
    e.target.value = null; 
  };

  const handleNewProject = () => {
    if (window.confirm('ARE YOU SURE YOU WANT TO CLEAR ALL AND START A NEW PROJECT?')) {
      engine.stopAllImmediate();
      newProject();
      clearUrlHash(); 
    }
  };

  const handleShareProject = async () => {
    const state = useAppStore.getState();
    const projectData = {
      edo: state.edo, tempo: state.tempo, tracks: state.tracks, blocks: state.blocks,
      instruments: state.instruments, showCircleLabels: state.showCircleLabels,
      circleZoom: state.circleZoom, hexOctaveShift: state.hexOctaveShift
    };

    setShareStatus('COMPRESSING...'); 
    try {
      const compressedData = await compressProject(projectData);
      const shareUrl = `${window.location.origin}${window.location.pathname}#project=${compressedData}`;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl)
          .then(() => triggerSuccess())
          .catch(() => executeFallbackCopy(shareUrl));
      } else {
        executeFallbackCopy(shareUrl);
      }
    } catch (err) {
      alert("Failed to build link");
      setShareStatus('🔗 SHARE');
    }
  };

  const executeFallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy'); 
      triggerSuccess();
    } catch (err) {
      alert("Please copy link manually: " + text);
      setShareStatus('🔗 SHARE');
    }
    document.body.removeChild(textArea);
  };

  const triggerSuccess = () => {
    setShareStatus('COPIED!');
    setTimeout(() => setShareStatus('🔗 SHARE'), 2000);
  };

  const handleExecuteExport = async () => {
    setShowExportSettingsOpen(false);
    await engine.init();
    setIsExporting(true);

    const state = useAppStore.getState();
    let maxBeats = 4.0;
    state.blocks.forEach(b => {
      const end = b.startBeat + b.durationBeats;
      if (end > maxBeats) maxBeats = end;
    });

    const beatDurationSec = 60 / state.tempo;
    const timelineSec = maxBeats * beatDurationSec;
    const renderDurationSec = exportMode === 'leave' ? (timelineSec + 6.0) : timelineSec;

    try {
      let buffer = await Tone.Offline(async (context) => {
        const limiter = new Tone.Limiter(-1).toDestination();
        const offlineSynths = {};

        for (const inst of state.instruments) {
          const synth = new Tone.PolySynth(Tone.Synth, { volume: -15 });
          const delay = new Tone.FeedbackDelay("8n", 0.4);
          const reverb = new Tone.Freeverb({ roomSize: 0.6, dampening: 2000 });

          synth.chain(delay, reverb, limiter);
          synth.set({
            oscillator: { type: inst.waveType },
            envelope: { 
              attack: inst.a_disabled ? 0.01 : inst.attack / 1000, 
              decay: inst.d_disabled ? 0.1 : inst.decay / 1000, 
              sustain: inst.s_disabled ? 1.0 : inst.sustain / 127, 
              release: inst.r_disabled ? 0.1 : inst.release / 1000 
            }
          });
          reverb.wet.value = inst.reverb ?? 0.2;
          delay.wet.value = inst.delay ?? 0.1;
          offlineSynths[inst.id] = synth;
        }

        state.blocks.forEach((block) => {
          const startSeconds = block.startBeat * beatDurationSec;
          const durSeconds = block.durationBeats * beatDurationSec;
          const synth = offlineSynths[block.instrumentId];

          if (synth && block.notes.length > 0) {
            const blockBaseFreq = block.baseFreq || 261.63;
            const freqs = block.notes.map(n => getFrequency(n, state.edo, blockBaseFreq));
            const vel = (block.velocity !== undefined ? block.velocity : 100) / 127;
            synth.triggerAttackRelease(freqs, durSeconds, startSeconds, vel);
          }
        });

      }, renderDurationSec);

      if (exportMode === 'leave') {
        const threshold = 0.00005;
        let endFrame = buffer.length - 1;
        for (let i = buffer.length - 1; i >= 0; i--) {
          let hasSignal = false;
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            if (Math.abs(buffer.getChannelData(c)[i]) > threshold) {
              hasSignal = true; break;
            }
          }
          if (hasSignal) { endFrame = i; break; }
        }
        if (endFrame !== buffer.length - 1) {
          const finalEndFrame = Math.min(buffer.length, endFrame + Math.floor(buffer.sampleRate * 0.1));
          const cropped = Tone.context.createBuffer(buffer.numberOfChannels, finalEndFrame, buffer.sampleRate);
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const src = buffer.getChannelData(c);
            const dst = cropped.getChannelData(c);
            for (let i = 0; i < finalEndFrame; i++) dst[i] = src[i];
          }
          buffer = cropped;
        }
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

  return (
    <div className="daw-app-container">
      <KeyboardController />
      <div className="daw-header-toolbar" style={{ display: 'grid', gridTemplateColumns: '1.2fr auto 1.3fr', alignItems: 'center', border: '2px solid #fff', padding: '10px 20px', marginBottom: '10px', flexShrink: 0, gap: '20px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '1px', fontWeight: 'bold' }}>MICROTONAL_DAW</h1>
          <MidiController />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
          <select 
            className="ut-select" 
            style={{ borderColor: '#ffce32', color: '#ffce32', fontSize: '11px', padding: '5px' }}
            value={activeDemoKey}
            onChange={(e) => {
              engine.stopAllImmediate(); 
              loadDemoTrack(e.target.value);
            }}
          >
            <option value="empty" disabled hidden>EMPTY PROJECT</option>
            <option value="custom" disabled hidden>CUSTOM / UPLOADED</option>
            <option value="smart_aleck">DEMO: SMART ALECK (31 EDO)</option>
            <option value="the_whispering_shrine">DEMO: WHISPERING SHRINE (22 EDO)</option>
            <option value="neon_groove">DEMO: NEON GROOVE (19 EDO)</option>
          </select>

          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px' }} onClick={handleNewProject}>NEW</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px', borderColor: '#ffce32', color: '#ffce32' }} onClick={handleSaveProject}>SAVE JSON</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px', borderColor: '#7FFDEB', color: '#7FFDEB' }} onClick={() => fileInputRef.current?.click()}>LOAD JSON</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 14px', borderColor: '#59DC90', color: '#59DC90' }} onClick={() => setShowExportSettingsOpen(true)}>💾 RENDER WAV</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px', borderColor: '#ffaa00', color: '#ffaa00' }} onClick={() => setShowHelp(true)}>[?] HELP</button>
          <button className="ut-btn" style={{ fontSize: '11px', padding: '5px 12px', borderColor: '#ffce32', color: '#ffce32' }} onClick={handleShareProject}>{shareStatus}</button>

          <input type="file" ref={fileInputRef} onChange={handleLoadProject} accept=".json" style={{ display: 'none' }} />
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '8px', borderRight: '1px solid #333', paddingRight: '15px' }}>
            {instruments.map(inst => {
              const icons = { triangle: '▲', saw: '◣', square: '■', sine: '~' };
              const icon = icons[inst.id] || '~';
              return (
                <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={`Global ${inst.name} Color`}>
                  <input 
                    type="color" 
                    value={inst.color} 
                    onChange={(e) => updateInstrument(inst.id, { color: e.target.value })}
                    style={{ width: '16px', height: '16px', padding: 0, border: '1px solid #fff', cursor: 'pointer', background: 'none' }}
                  />
                  <span style={{ fontSize: '10px', color: inst.color, fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {icon} {inst.id.substring(0,3).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>EDO:</label>
              <input 
                type="number" min="5" max="72" 
                style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '12px', textAlign: 'center', padding: '2px' }}
                value={edo} 
                onChange={(e) => setEdo(Math.min(72, Math.max(5, parseInt(e.target.value) || 31)))} 
              />
            </div>
            <input type="range" min="5" max="72" value={edo} onChange={(e) => setEdo(Number(e.target.value))} style={{ accentColor: '#fff', cursor: 'pointer' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>VOLUME:</label>
              <input 
                type="number" min="0" max="100" 
                style={{ width: '45px', background: '#000', color: '#fff', border: '1px solid #444', fontSize: '12px', textAlign: 'center', padding: '2px' }}
                value={Math.round(volume * 100)} 
                onChange={(e) => setVolume(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) / 100)} 
              />
            </div>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ accentColor: '#fff', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      <div className="daw-workspace-upper">
        <div className="daw-circle-box" style={{ display: 'flex', flexDirection: 'column', padding: '10px', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <CircleTuner />
          </div>
          <div className="daw-canvas-faded" style={{ width: '100%', display: 'flex', justifyContent: 'center', flexShrink: 0, borderTop: '1px solid #1a1a1a', paddingTop: '8px' }}>
            <Visualizer />
          </div>
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
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ border: '3px solid #fff', backgroundColor: '#000', padding: '40px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'monospace', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #fff', paddingBottom: '15px', marginBottom: '25px' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#FFCE32', letterSpacing: '1px' }}>[ MICROTONAL_DAW HELP CENTER ]</span>
              <button className="ut-btn" style={{ padding: '6px 14px', fontSize: '11px' }} onClick={() => setShowHelp(false)}>X CLOSE</button>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.8', display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div>
                <span style={{ color: '#59DC90', fontWeight: 'bold', fontSize: '16px', borderBottom: '1px solid #59DC90', paddingBottom: '2px' }}>◆ ТАЙМЛАЙН И ПОТОКИ (STREAMS):</span>
                <ul style={{ margin: '10px 0 0 25px', padding: 0 }}>
                  <li style={{ marginBottom: '8px' }}><b>Клик левой кнопкой на пустом месте:</b> Создает новый кадр (cadre) в месте клика с привязкой к сетке.</li>
                  <li style={{ marginBottom: '8px' }}><b>Клик левой кнопкой на блок:</b> Выделяет кадр для редактирования нот и ADSR.</li>
                  <li style={{ marginBottom: '8px' }}><b>Клик по пустому месту:</b> Снимает фокус / сбрасывает выделение.</li>
                  <li style={{ marginBottom: '8px' }}><b>Зажать и тащить блок:</b> Перемещение кадра (смена инструментов!).</li>
                  <li style={{ marginBottom: '8px' }}><b>Потянуть правый край блока:</b> Изменение длительности кадра с шагом 1/32 доли.</li>
                </ul>
              </div>
              <div style={{ borderTop: '2px dashed #333', paddingTop: '20px', marginTop: '10px', textAlign: 'center', color: '#ffce32', fontWeight: 'bold' }}>
                [ CLICK ANYWHERE OUTSIDE OR PRESS 'CLOSE' TO GO BACK ]
              </div>
            </div>
          </div>
        </div>
      )}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, fontFamily: 'monospace' }}>
          <div style={{ border: '3px solid #fff', padding: '35px', backgroundColor: '#000', maxWidth: '650px', width: '90%', color: '#fff' }}>
            <h2 style={{ fontSize: '20px', color: '#ffce32', borderBottom: '2px solid #fff', paddingBottom: '12px', margin: '0 20px 0', letterSpacing: '1px' }}>[ WAV EXPORT CONTROL ]</h2>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '25px' }}>
              <button className="ut-btn" style={{ borderColor: '#59DC90', color: '#59DC90', fontSize: '13px', padding: '8px 20px' }} onClick={handleExecuteExport}>START RENDER</button>
              <button className="ut-btn" style={{ borderColor: '#888', color: '#888', fontSize: '13px', padding: '8px 20px' }} onClick={() => setShowExportSettingsOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;