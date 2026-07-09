# 🌌 Microtonal DAW (µDAW)

A web-based digital audio workstation (DAW) designed for arranging, synthesizing, and analyzing polyphonic music in dynamic microtonal Equal Divisions of the Octave (EDO).

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tone.js](https://img.shields.io/badge/Tone.js-v15-000000?style=flat-square&logo=audio&logoColor=white)](https://tonejs.github.io/)
[![Zustand](https://img.shields.io/badge/Zustand-State-443E38?style=flat-square)](https://github.com/pmndrs/zustand)
[![Vite](https://img.shields.io/badge/Vite-Tooling-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-W3C-005A9C?style=flat-square&logo=w3c&logoColor=white)](https://www.w3.org/TR/webaudio/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 📌 Table of Contents
1. [Core Features](#-core-features)
2. [Project File Structure](#-project-file-structure)
3. [Audio DSP Signal Chain](#-audio-dsp-signal-chain)
4. [Offline Audio Rendering & Silence Trimming](#-offline-audio-rendering--silence-trimming)
5. [User Controls & Hotkeys](#-user-controls--hotkeys)
6. [Project File Schema (.json)](#-project-file-schema-json)
7. [Installation & Deployment](#-installation--deployment)

---

## 🚀 Core Features

### 🎹 Keyboard & Input Systems
*   **Isomorphic Hexagonal Grid:** A 11x9 pointy-topped honeycomb lattice representing key steps. It maps pitch relations isomorphically (interval shapes remain identical across registers).
*   **Hardware Octave Shift & Clamp:** Supports shifting the grid range on the fly (from -4 to +6 octaves). A strict filter automatically hides grid cells falling outside the valid hardware boundaries: `[-96, 186]` (B0 to C10 in 31 EDO).
*   **Web MIDI & QWERTY Integration:** Processes physical MIDI controllers and computer keyboards using absolute hardware `e.code` parameters to prevent layout interference. Automatically records inputs directly into the selected timeline block.

### 📐 Tuning & Geometry Viz
*   **11-Orbit Concentric Tuner:** Maps steps 0 to EDO-1 and visualizes chord shapes as dynamic polygons stretching across 11 concentric octave rings (Octaves 0 to 10). The middle baseline ring (Octave 4) is highlighted in solid white.
*   **Vector Label Projection:** Spacing of node labels on the circle is calculated using radial vector mathematics:
    $$x_{\text{label}} = \text{center} + (\text{radius} + 12) \cdot \cos(\theta)$$
    $$y_{\text{label}} = \text{center} + (\text{radius} + 12) \cdot \sin(\theta)$$
    This prevents clashing. Labels are displayed selectively for active nodes to maintain an uncluttered layout, with a global toggle in the header.
*   **Universal Scale Mask:** Filters available keys on the circle and hex grid using cent-based interval arrays (Chromatic, Major, Minor, Pentatonic, 5-limit Just Intonation Major) mapped dynamically:
    $$\text{Step}_{\text{EDO}} = \text{round}\left( \frac{\text{Cents}}{1200} \cdot \text{EDO} \right)$$

### ⏱ Linear Sequencer & Editing
*   **Multi-Track Grid:** Supports adding, deleting, and reordering parallel streams with confirmation dialogs. Tracks are automatically labeled sequentially (`STREAM 1` to `STREAM N`) upon list changes.
*   **Click-to-Paint & Resizing:** Adds blocks at snapped 1/4 beats. Resizing block length from the right edge snaps strictly to 1/32 subdivisions of a beat. Displayed lengths are converted to simplified musical fractions (e.g., `17/32`, `3/4`) using Euclid's GCD algorithm.
*   **Block-Level Configurations:** Edit per-block instrument type, independent volume velocity (0–127), and dynamic transposition (setting the base root frequency by right-clicking nodes on the circle or grid).

---

## 📁 Project File Structure

The project maintains a strict separation of concerns between state, DSP (digital signal processing), geometry utilities, and view-rendering components:

```text
microtonal-daw/
├── src/
│   ├── audio/
│   │   └── AudioEngine.js       # Core Tone.js synthesizers and master effects chain
│   ├── store/
│   │   └── useAppStore.js       # Global state and timeline parameter tree (Zustand)
│   ├── utils/
│   │   └── mathUtils.js         # 31-EDO pitch naming, scale calculators, and WAV encoder
│   ├── components/
│   │   ├── CircleTuner.jsx      # 11-orbit concentric circular tuner & vector coordinate mapper
│   │   ├── HexGrid.jsx          # 3-octave isomorphic grid with transposer and limits [B0-C10]
│   │   ├── KeyboardController.jsx # QWERTY keyboard map (physical key codes) and spacebar trigger
│   │   ├── MidiController.jsx   # Web MIDI integration with active block recording
│   │   ├── SynthControls.jsx    # Compact vertical ADSR envelopes and percentage-based FX sliders
│   │   ├── Timeline.jsx         # Multi-track timeline, mouse drag-and-drop, 1/32 resizing, and ruler
│   │   └── Visualizer.jsx       # Pre-fader oscilloscope and 2D phase-space plot
│   ├── App.jsx                  # Master responsive layout and initialization lifecycle
│   ├── index.css                # Global retro-minimalist styles and 1440px breakpoint layout
│   └── main.jsx                 # DOM entry point
├── asteria.json                 # Pre-composed 16-bar demo project (loadable via UI)
├── vite.config.js               # Vite server (0.0.0.0, 8080) and deploy configurations
└── package.json                 # Project dependencies and build scripts
```

---

## 🎛 Audio DSP Signal Chain

To provide continuous visual telemetry, the analyzer is placed in a **Pre-Fader** master split. All synths route through local delay and reverb effects directly into the `AnalyserNode`. The output is then scaled by the `VolumeNode` and clamped by a master limiter.

```
+------------+     +------------------+     +-------------------+
| Synth (Saw)| --> | Feedback Delay   | --> | Reverb (Freeverb) | --+
+------------+     +------------------+     +-------------------+   |
                                                                    |
+------------+     +------------------+     +-------------------+   |
| Synth (Sin)| --> | Feedback Delay   | --> | Reverb (Freeverb) | --+
+------------+     +------------------+     +-------------------+   |
                                                                    v
                                                            +---------------+
                                                            | Master Mix Bus|
                                                            +---------------+
                                                                    |
                                                                    v
                                                            +---------------+
                                                            | Analyser Node | (Pre-Fader)
                                                            +---------------+
                                                              |           |
                                          +-------------------+           +-------------------+
                                          |                                                   |
                                          v                                                   v
                                  +---------------+                                   +---------------+
                                  | Audio Render  | (Offline Context)                 | Volume Node   | (Gain Control)
                                  +---------------+                                   +---------------+
                                                                                              |
                                                                                              v
                                                                                      +---------------+
                                                                                      | Master Limiter| (-1dB Brickwall)
                                                                                      +---------------+
                                                                                              |
                                                                                              v
                                                                                      +---------------+
                                                                                      | Audio Output  | (Destination)
                                                                                      +---------------+
```

---

## 💾 Offline Audio Rendering & Silence Trimming

Clicking `EXPORT WAV` executes a high-speed background rendering process using an isolated `OfflineAudioContext`. Instead of recording real-time audio, the system processes samples at the maximum speed supported by the CPU.

### Dynamic Silence Trimming Algorithm

To prevent trailing silence in the rendered file while retaining release times and delay feedback tails, the resulting `AudioBuffer` undergoes a backward-scanning truncation sweep:

```javascript
const threshold = 0.00005; // ~ -86 dBFS silence boundary
let endFrame = audioBuffer.length - 1;

for (let i = length - 1; i >= 0; i--) {
  let hasSignal = false;
  for (let c = 0; channel < numChannels; c++) {
    if (Math.abs(audioBuffer.getChannelData(c)[i]) > threshold) {
      hasSignal = true;
      break;
    }
  }
  if (hasSignal) {
    endFrame = i;
    break;
  }
}

const finalEndFrame = Math.min(length, endFrame + sampleRate * 0.1);
const croppedBuffer = slice(audioBuffer, 0, finalEndFrame);
```

---

## ⌨️ User Controls & Hotkeys

### Keyboard & Transport Shortcuts
| Key | Input Target | Executed Action |
| :--- | :--- | :--- |
| `Space` | Global | Play / Pause transport playback (bypassed when focused inside inputs) |
| `Esc` | Global | Deselect and remove focus from the active timeline block |
| `Ctrl + D` | Block Selection | Clone the focused block and append it sequentially in the same track |
| `Double STOP` | Timeline Button | **Panic Command:** Hard reset on transport, releases all voice nodes, and brief mute |
| `Z X C...` (Rows) | Keyboard Input | Direct polyphonic synth triggering with real-time note-to-block recording |

### Mouse Drag & Click Gestures
| Control Target | Mouse Event | Executed Action |
| :--- | :--- | :--- |
| **Empty Track Lane** | Left Click | Paints a new block at the grid-snapped beat location |
| **Active Block** | Left Click | Selects block and routes its ADSR properties to the Instrument Control |
| **Active Block** | Drag body | Real-time horizontal movement (beats) and vertical track switching |
| **Active Block** | Drag right edge | Resizes block duration (quantized strictly to 1/32 increments) |
| **Active Block** | Right Click | Deletes the block from the track timeline immediately |
| **Circle / Hex Grid** | Left Click | Toggles note activation inside the currently selected timeline block |
| **Circle / Hex Grid** | Right Click | Set selected pitch frequency as the Root centre for the active block |

---

## 📊 Project File Schema (.json)

µDAW serializes composition states to standard JSON files. This scheme is fully compatible across all EDO values:

```json
{
  "edo": 31,
  "tempo": 130,
  "currentScale": "just_major",
  "showCircleLabels": true,
  "tracks": [
    { "id": "track_1", "name": "STREAM 1" }
  ],
  "blocks": [
    {
      "id": "b_1",
      "trackId": "track_1",
      "startBeat": 0.0,
      "durationBeats": 4.0,
      "instrumentId": "saw",
      "baseFreq": 261.63,
      "velocity": 100,
      "notes": [0, 10, 18]
    }
  ],
  "instruments": [
    {
      "id": "saw",
      "name": "SAW",
      "color": "#ED6ED8",
      "waveType": "sawtooth",
      "attack": 100,
      "decay": 300,
      "sustain": 90,
      "release": 1500,
      "reverb": 0.3,
      "delay": 0.1,
      "a_disabled": false
    }
  ]
}
```

---

## 🛠 Installation & Deployment

### Prerequisite Installation
*   Node.js (v18.x or higher)
*   npm (v9.x or higher)

### Installation
```bash
# 1. Clone repository
git clone https://github.com/stornov/microtonal-daw.git

# 2. Enter project folder
cd microtonal-daw

# 3. Install packages
npm install

# 4. Start local development server (Exposed to 0.0.0.0, Port 8080)
npm run dev
```

### Automatic Deployment
```bash
npm run deploy
```