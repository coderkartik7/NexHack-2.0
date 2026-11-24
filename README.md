# GestureLearn (Hands-Free Classroom Control System)

GestureLearn is a browser-based, hands-free classroom control system designed to allow learners to interact with lessons using an ordinary webcam and comfortable facial or hand gestures. With individualized per-learner calibration, natural resting movements and twitches are never mistaken for commands.

Built for **Phase 1 (Vision Pipeline)** and **Phase 2 (Calibration Engine)**. All vision processing and storage run entirely client-side. Video is never recorded or transmitted to any server.

---

## Tech Stack
- **Framework & Language**: React 19, TypeScript (strict mode), Vite 8
- **Vision AI**: `@mediapipe/tasks-vision` (FaceLandmarker with blendshapes, HandLandmarker)
- **Signal Filtering**: 1€ Filter (One Euro Filter) for adaptive jitter reduction and responsive velocity tracking
- **State Management**: Zustand
- **Storage**: Dexie (IndexedDB)
- **Styling**: Tailwind CSS
- **Testing**: Vitest

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`. When prompted, grant webcam permissions.

### 3. Run Unit Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```

---

## Signal Definitions (Distance-Invariant & Normalized)

All signals extracted in `src/vision/signals.ts` are mathematically normalized so they remain invariant to the learner's distance from the webcam:

### Head Mode Signals
1. **`headX`**: Horizontal nose-tip offset from the mid-eye point divided by the inter-ocular distance (IOD), mirrored for natural head steering:
   $$\text{headX} = - \frac{\text{noseTip}_x - \text{midEye}_x}{\text{IOD}}$$
2. **`headY`**: Vertical nose-tip offset from the mid-eye point divided by the IOD:
   $$\text{headY} = \frac{\text{noseTip}_y - \text{midEye}_y}{\text{IOD}}$$
3. **`headRoll`**: Angular roll of the head calculated as the angle of the line connecting both eye centers:
   $$\text{headRoll} = \text{atan2}(\Delta y_{\text{eyes}}, \Delta x_{\text{eyes}})$$
4. **`jawOpen`**: MediaPipe blendshape score for jaw opening $[0, 1]$.
5. **`browRaise`**: MediaPipe blendshape score for `browInnerUp` $[0, 1]$.
6. **`blink`**: Arithmetic mean of `eyeBlinkLeft` and `eyeBlinkRight` blendshapes $[0, 1]$.

### Hand Mode Signals
1. **`handX`, `handY`**: Coordinates of index fingertip (landmark 8), with X mirrored: $(1 - \text{landmark}_8.x)$.
2. **`pinch`**: Distance between thumb tip (landmark 4) and index fingertip (landmark 8), divided by hand size (distance between wrist landmark 0 and middle finger MCP landmark 9):
   $$\text{pinch} = \frac{\|\text{thumbTip} - \text{indexTip}\|}{\|\text{wrist} - \text{middleMCP}\|}$$
3. **`openPalm`**: Average Euclidean distance of all 5 fingertips to the wrist, divided by hand size:
   $$\text{openPalm} = \frac{\frac{1}{5} \sum_{i \in \text{tips}} \|\text{tip}_i - \text{wrist}\|}{\|\text{wrist} - \text{middleMCP}\|}$$

*Note: If the tracker loses the subject, signals immediately emit `null` rather than emitting stale values.*

---

## 1€ (One Euro) Filter

Implemented in `src/vision/oneEuro.ts` to balance low-jitter stationary fixation with minimal lag during rapid movement:
- Minimum cutoff frequency $f_{c, \text{min}} = 1.0\text{ Hz}$
- Speed coefficient $\beta = 0.007$ (or $0.015$ for cursor coordinates)
- Dynamic cutoff: $f_c = f_{c, \text{min}} + \beta \cdot |\hat{\dot{x}}|$

---

## Threshold Computation & Hysteresis Formulas

In `src/calibration/thresholds.ts`, thresholds are calculated in the active direction of the gesture (inverting values for low-is-active gestures such as pinch):

1. **Enter Threshold**:
   $$\text{enter} = \text{restMax} + 0.4 \times (\text{gestureMedianPeak} - \text{restMax})$$
   *(Note: uses 99th percentile $p_{99}$ if raw maximum is an outlier).*
2. **Exit Threshold (Hysteresis)**:
   $$\text{exit} = \text{restMax} + 0.2 \times (\text{gestureMedianPeak} - \text{restMax})$$
   *Since $\text{exit} < \text{enter}$, hysteresis prevents boundary stuttering and flickering activations.*
3. **Timing Constraints**:
   - $\text{minHoldMs} = \text{clamp}(0.4 \times \text{medianDuration}, 120\text{ ms}, 400\text{ ms})$
   - $\text{cooldownMs} = \text{clamp}(\text{minHoldMs} + 200\text{ ms}, 300\text{ ms}, 600\text{ ms})$

---

## Separability & Overlap Scoring

In `src/calibration/separability.ts`, each calibrated command is evaluated against resting noise:
- **d-Prime ($d'$) Score**:
  $$d' = \frac{\mu_{\text{gesture}} - \mu_{\text{rest}}}{\sqrt{\frac{\sigma^2_{\text{gesture}} + \sigma^2_{\text{rest}}}{2}}}$$
- **Overlap Fraction**: Percentage of resting samples exceeding the `enter` threshold.
- **Rating Criteria**:
  - `reliable`: $d' \ge 3.0$ and $\text{overlap} < 0.5\%$
  - `marginal`: $d' \ge 1.8$ and $\text{overlap} < 5.0\%$
  - `unreliable`: $d' < 1.8$ or $\text{overlap} \ge 5.0\%$ (prompts the user with a warning banner and suggests selecting an alternate gesture or re-recording).

---

## Drift Handling Hook

Exposes `updateNeutral(profile, currentCoords, alpha)`:
$$\text{offset}_{t+1} = (1 - \alpha)\text{offset}_t + \alpha \cdot \text{coords}_{\text{current}}$$
This pure function slowly re-centers the baseline cursor offset during resting periods without affecting active interaction.

---

## Architecture & Extensibility for Later Phases

- `src/vision/pipeline.ts`: Framework-agnostic observable pattern (`subscribe(callback)`) ready for Phase 3 intent state machines and interaction managers.
- `src/storage/profiles.ts`: Dexie IndexedDB CRUD, JSON export/import with schema validation, and multi-profile switching.
