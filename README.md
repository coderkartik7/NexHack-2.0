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

## Phase 3: Intent Engine State Machine

The Intent Engine converts calibrated continuous biometric signals into discrete, reliable commands. A pure function `stepMachine(ctx, rawSignal, binding, now)` drives each command state:

```
                  signal >= enter
       ┌────────────────────────────────────┐
       │                                    ▼
   [ IDLE ] ◄───────── signal < exit ─── [ CANDIDATE ]
       ▲       (twitch rejected)            │
       │                                    │ hold duration >= minHoldMs
       │                                    ▼
       │                             [ ACTIVE ] (emits exactly 1 'fire' event)
       │                                    │
       │                                    ├─ signal < exit (natural release)
       │                                    └─ signal === null (tracking_lost release)
       │                                    ▼
       │                             [ RELEASE_WAIT ]
       │                                    │
       │                                    ▼
       └────────── now >= cooldownEnd ─── [ COOLDOWN ]
                 (ignores all inputs)
```

### Hysteresis, Hold, and Cooldown Rules
1. **Hysteresis Boundary**: Once a candidate starts at $\text{signal} \ge \text{enter}$, it remains valid while staying above $\text{exit}$. Since $\text{exit} < \text{enter}$, boundary jitter never flickers state.
2. **Twitch Rejection**: Reaching `ACTIVE` strictly requires continuous holding above `exit` for `minHoldMs`. Dropping early drops immediately back to `IDLE` with zero side effects.
3. **Mutual Exclusion**: Only one of `select` or `grab` may occupy `CANDIDATE` or `ACTIVE` at a time. The first to reach `CANDIDATE` locks the lock-gate, suppressing competitor activations.
4. **Click Stabilization**: During `CANDIDATE`, the screen cursor is frozen at its position from ~150 ms before gesture onset, eliminating muscle twitch displacement during jaw opening, eye squinting, or pinching.

---

## Signal Sources & Simulation

The abstract `SignalSource` interface enables testing and demonstration without webcam hardware:
- **`LiveSource`**: Wraps MediaPipe vision pipeline.
- **`MouseSim`**: Drives cursor from normalized mouse coordinates and gesture triggers via keys:
  - Hold `J`: `select` command trigger
  - Hold `K`: `grab` command trigger
  - Hold `L`: `pause` command trigger
- **`SignalRecorder` / `ReplaySource`**: Records frames to JSON traces and deterministically replays them with variable speed control.

---

## Phase 5: Event Logging Schema (FastAPI Compatible)

All user sessions, intent transitions, undo operations, and attempts produce append-only structured events:

```typescript
interface SessionEvent {
  sessionId: string;
  profileId: string;
  seq: number;
  t: number; // ms since session start
  type:
    | 'gesture_onset'
    | 'command_executed'
    | 'undo'
    | 'pause'
    | 'resume'
    | 'tracking_lost'
    | 'tracking_restored'
    | 'answer_attempt'
    | 'label_drop'
    | 'drag_cancelled'
    | 'task_complete';
  command?: 'select' | 'grab' | 'pause';
  target?: string;
  correct?: boolean;
  gestureOnsetT?: number;
  executedT?: number;   // for response time = executedT - gestureOnsetT
  undone?: boolean;      // flagged true when the user undoes the action
  source: 'live' | 'mouse_sim' | 'replay';
  mode: 'activity' | 'rest_test';
}
```
All sessions are stored in IndexedDB (`GestureLearnDB.sessions`) and can be exported as standard JSON for downstream FastAPI analytics.

---

## Phase 7: Evaluation & Study Protocol (N=2 Pilot System)

Phase 7 implements an empirical evaluation and reporting framework adhering to scientific reporting honesty, accessible UI, and strict privacy principles.

### Architecture & Capabilities
1. **5-Stage Protocol Runner (`src/eval/protocol.ts`, `ProtocolRunner.tsx`)**:
   - Guided flow: `calibration_check` → `practice` → `activity` → `rest_test` → `recalibrate_repeat`.
   - Anonymous participant codes (`P1`, `P2`) with required consent gating stored in Dexie `participants`.
2. **60-Second Rest Test Panel (`src/eval/restTest.ts`, `RestTestPanel.tsx`, `RestTimeline.tsx`)**:
   - Rotating behavioral cues (relax, speak, shift posture, natural breathing).
   - Signal downsampling at $\le 10\text{ Hz}$.
   - Live canvas showing signal vs `enter`/`exit` thresholds with red pins on false activations.
3. **Facilitator Real-Time Bar (`FacilitatorBar.tsx`)**:
   - Allows observers to flag unintended commands live during activity runs.
4. **Pure Metrics Engine (`src/eval/metrics.ts`, `src/eval/stats.ts`)**:
   - Median and 90th percentile response time ($p_{90}$) via **R-7 / NIST standard linear interpolation**.
   - Deduplicated accidental activations (undone + facilitator flags).
   - Accidental activation rate per minute (Activity vs Rest).
   - Task completion breakdown (quiz vs drag-and-drop).
   - Tracking loss frequency and total duration.
5. **Comparison & Results Dashboard (`ResultsDashboard.tsx`, `ComparisonView.tsx`, `ThresholdCompare.tsx`)**:
   - Participant A vs Participant B side-by-side comparison with metric deltas.
   - High-contrast SVG bar visualizers and side-by-side threshold profiles.
   - Rule-based factual findings narrative generation.
   - Structured CSV export, full JSON bundle import/export, and print-optimized layout.
   - Labeled synthetic demo data fallback (`[SYNTHETIC DEMO DATA, NOT REAL RESULTS]`).

## Phase 8: Eye (Gaze) Mode Pipeline & Calibration

GestureLearn includes an **Eye (gaze) mode**, in which the on-screen cursor follows the learner's eye gaze using an ordinary webcam, while selection, grabbing, and pausing remain deliberate calibrated gestures handled by the intent engine.

### Hard Constraints & Realistic Expectations
- **Webcam gaze is naturally imprecise**: Typical laptops experience ~100–200 px of error due to webcam focal length, sensor noise, head translations, and eye corner occlusion.
- **Accessible Design for Imprecision**: The UI uses large interactive targets ($\ge 120\times 120\text{ px}$ in eye mode), generous hit padding, sticky hover hysteresis, target magnetism, and an explicit live accuracy score badge.
- **Privacy Gating**: No video ever leaves the device. Only 12 numeric features per frame and the fitted regression coefficients are stored in IndexedDB.
- **SignalSource Abstraction**: Eye mode integrates seamlessly with `LiveSource`, `MouseSim` (which emulates gazeX/gazeY), and replay traces.

### 1. Gaze Feature Extraction (`src/vision/gazeFeatures.ts`)
From MediaPipe's 478 face landmarks (which include the refined 10 iris landmarks: 468–477):
1. **Iris Position Within Socket**: For both eyes, the iris center is projected onto the eye-corner axis (landmarks 33–133 for left, 263–362 for right) and normalized by eye width. Vertical position is computed relative to the eyelid midline and normalized by eye width.
2. **Head Pose Compensation**: Compensates for small head movements using yaw, pitch, roll (derived geometrically or from the transformation matrix), face frame position (nose tip $x, y$), and face scale (inter-ocular distance in normalized coordinates).
3. **Blink & Validity Flagging**: Eyelid openness ratio is monitored. When openness drops below a calibrated threshold, the frame is flagged invalid with `blinkDetected: true` and features are returned as `null` (never stale). Extreme head yaw/pitch ($> 35^\circ$) also flags the frame invalid.
4. **Smoothing**: A light 1€ filter ($f_{c,\text{min}} = 0.8\text{ Hz}, \beta = 0.005$) stabilizes raw feature noise.

### 2. Ridge Regression Model (`src/gaze/regression.ts`, `src/gaze/model.ts`)
- **Ridge Closed-Form Solver**: Built from scratch without heavy external libraries. Standardizes features with $(\mathbf{X} - \mu)/\sigma$, appends a bias column (unregularized), and solves $(\mathbf{X}^T\mathbf{X} + \lambda \mathbf{I})\mathbf{w} = \mathbf{X}^T\mathbf{y}$ separately for screen $X$ and $Y$ using Gaussian elimination with partial pivoting.
- **Cross-Validation**: Automatically selects the optimal regularization penalty $\lambda \in [0.001, 100.0]$ via $k$-fold cross-validation.
- **Degenerate Rejection**: Calibration sets with $<9$ points or near-zero variance are rejected with descriptive errors.
- **Predictions Clamped**: Coordinates are strictly clamped to viewport bounds $[0, \text{viewportWidth}] \times [0, \text{viewportHeight}]$.

### 3. Gaze Calibration Wizard (`src/components/GazeCalibrationStep.tsx`)
1. **Setup Guidance**: Clear distance check (~arm's length), lighting advice, and live tracking-quality indicator.
2. **Calibration Points**: Presents a pulsing target dot at 9 or 16 screen points. Waits 600 ms for saccadic settle, collects 30 valid frames (rejecting blinks and outliers via median filtering), and records the median feature vector.
3. **Head-Movement Coverage (20s)**: Dots appear at varied locations while the learner makes small, natural head movements, allowing the ridge regression weights to learn head-pose compensation.
4. **Validation Step (`GazeValidation.tsx`)**: Evaluates the model against held-out targets, calculating `meanErrorPx` and $p_{90}$ error. Displays an accuracy badge:
   - **Good**: $< 120\text{ px}$ mean error
   - **Fair**: $120–200\text{ px}$ mean error
   - **Poor**: $> 200\text{ px}$ mean error (offers **Recalibrate** or **Continue with Large-Target Mode** which expands target sizes and magnetism radii).

### 4. Gaze Cursor Pipeline (`src/gaze/gazeCursor.ts`, `fixation.ts`, `drift.ts`)
- **Fixation Detection (I-DT)**: Identifies fixations using dispersion threshold ($<65\text{ px}$) over minimum duration ($\ge 120\text{ ms}$). Snaps the cursor to the fixation centroid and releases immediately upon saccades.
- **Blink Stale Hold**: Holds the last valid cursor position for up to 300 ms during blinks (marked "stale"); tracking is flagged lost if eyes remain closed beyond 300 ms.
- **Drift Correction (`drift.ts`)**:
  - *Automatic Mild EMA Correction*: Upon successful target selection, slowly adjusts offset toward the target center (rate $\alpha = 0.08$, capped at 120 px).
  - *Manual Re-Center*: Resets accumulated offset instantly with a single button or gesture.
- **Click Stabilization**: Freezes the cursor position from ~150 ms before gesture onset through activation, so intentional long blinks or jaw movements never nudge the cursor off-target.
- **Dwell Selection Fallback**: Optional toggleable dwell selection (default 1000 ms) with a visible progress ring, logged as `source: 'dwell'`.

### 5. Eye Mode Gestures & Blink Separation
- Available non-disruptive gestures: `jawOpen`, `browRaise`, and `blink` (Long Blink).
- **Natural Blink Protection**: The calibrated `minHoldMs` for blink commands is strictly enforced to exceed the learner's natural blink duration (measured during the rest baseline) by at least 100 ms (default $\ge 450\text{ ms}$). In testing, 60 seconds of natural resting blinks produce 0 false triggers.

---

For complete mathematical definitions and privacy policies, see [docs/METHODOLOGY.md](file:///c:/Users/CoderKartik/Desktop/NexHack 2.0/docs/METHODOLOGY.md).
