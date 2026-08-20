const GESTURES = [
  { id: 'open_hand', name: 'Offene Hand', message: 'Du zeigst eine offene Hand', emoji: '✋' },
  { id: 'fist', name: 'Faust', message: 'Du zeigst eine Faust', emoji: '✊' },
  { id: 'peace', name: 'Peace-Zeichen', message: 'Du zeigst das Peace-Zeichen', emoji: '✌️' },
  { id: 'thumbs_up', name: 'Daumen hoch', message: 'Du zeigst Daumen hoch', emoji: '👍' },
  { id: 'pointing', name: 'Zeigefinger', message: 'Du zeigst mit dem Finger', emoji: '☝️' },
  { id: 'ok_sign', name: 'OK-Zeichen', message: 'Du zeigst das OK-Zeichen', emoji: '👌' }
];
const STORAGE_KEY = 'hand-gesture-ai-samples-v1';
const MODEL_KEY = 'hand-gesture-ai-model-v2';
const TARGET_SAMPLES = 100;
const K_NEIGHBORS = 5;
const CONFIDENCE_THRESHOLD = 0.54;

const state = {
  samples: loadJson(STORAGE_KEY, []), model: loadJson(MODEL_KEY, null),
  landmarker: null, streams: new Map(), recording: false, lastSampleAt: 0,
  lastVideoTimes: new Map(), lastActionAt: 0, lastActionGesture: null,
  volume: 50, playing: false, predictionHistory: [], cameraStarting: false
};
const $ = (selector) => document.querySelector(selector);

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveSamples() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.samples)); }
function toast(message) {
  const element = $('#toast'); element.textContent = message; element.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

function setupNavigation() {
  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-button, .page').forEach(item => item.classList.remove('active'));
    button.classList.add('active'); $(`#${button.dataset.page}`).classList.add('active');
    history.replaceState(null, '', `#${button.dataset.page}`);
  }));
  const initial = location.hash.slice(1);
  if (['live', 'training', 'about'].includes(initial)) document.querySelector(`[data-page="${initial}"]`).click();
}

async function getLandmarker() {
  if (state.landmarker) return state.landmarker;
  toast('Hand-Tracking wird geladen …');
  // MediaPipe is loaded only when the camera is requested. This keeps the
  // navigation and all data buttons usable even if the CDN is unavailable.
  const { FilesetResolver, HandLandmarker } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm'
  );
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
  );
  const options = {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'
    }, runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.55
  };
  try {
    state.landmarker = await HandLandmarker.createFromOptions(vision, options);
  } catch (error) {
    // Some older devices cannot use WebGL reliably. The CPU fallback is slower,
    // but keeps the app usable on a wider range of shared-hosting visitors.
    console.warn('GPU initialization failed, falling back to CPU.', error);
    options.baseOptions.delegate = 'CPU';
    state.landmarker = await HandLandmarker.createFromOptions(vision, options);
  }
  return state.landmarker;
}

async function startCamera(kind) {
  if (state.cameraStarting || state.streams.has(kind)) return;
  state.cameraStarting = true;
  const video = $(`#${kind}-video`);
  try {
    await getLandmarker();
    if (!state.streams.has(kind)) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      state.streams.set(kind, stream); video.srcObject = stream; await video.play();
    }
    const placeholder = $(`#${kind === 'live' ? 'camera' : 'training'}-placeholder`);
    if (placeholder) placeholder.classList.add('hidden');
    if (kind === 'live') $('#camera-status').textContent = '';
    else if ($('#record-button')) $('#record-button').disabled = false;
    requestAnimationFrame(() => processFrame(kind));
  } catch (error) {
    console.error(error);
    const openedAsFile = location.protocol === 'file:';
    const message = openedAsFile
      ? 'Bitte über localhost oder HTTPS öffnen – nicht per Doppelklick.'
      : 'Erlaube den Kamerazugriff und klicke einmal auf die Seite.';
    $('#gesture-emoji').textContent = '📷';
    $('#gesture-name').textContent = 'Kamera nicht verfügbar';
    $('#camera-status').textContent = message;
    toast(message);
  } finally {
    state.cameraStarting = false;
  }
}

async function processFrame(kind) {
  const video = $(`#${kind}-video`), canvas = $(`#${kind}-canvas`);
  if (!state.streams.has(kind)) return;
  if (video.readyState >= 2 && state.lastVideoTimes.get(kind) !== video.currentTime) {
    state.lastVideoTimes.set(kind, video.currentTime);
    const result = state.landmarker.detectForVideo(video, performance.now());
    drawLandmarks(canvas, video, result.landmarks[0]);
    if (kind === 'training') processTrainingFrame(result);
    else processLiveFrame(result);
  }
  requestAnimationFrame(() => processFrame(kind));
}

function drawLandmarks(canvas, video, landmarks) {
  const width = video.videoWidth || 1280, height = video.videoHeight || 720;
  if (canvas.width !== width) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;
  const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  ctx.strokeStyle = '#39d98a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  connections.forEach(([a,b]) => { ctx.beginPath(); ctx.moveTo(landmarks[a].x*width, landmarks[a].y*height); ctx.lineTo(landmarks[b].x*width, landmarks[b].y*height); ctx.stroke(); });
  landmarks.forEach(point => { ctx.beginPath(); ctx.arc(point.x*width, point.y*height, 5, 0, Math.PI*2); ctx.fillStyle = '#fffdf7'; ctx.fill(); ctx.strokeStyle = '#101820'; ctx.lineWidth = 2; ctx.stroke(); });
}

// Translation, rotation and scale normalization make samples less dependent on
// where the hand is in the image, how large it is, or how the wrist is rotated.
function extractFeatures(landmarks, handedness = 'Right') {
  return normalizedPoints(landmarks, handedness).flatMap(p => [p.x, p.y, p.z]);
}

function normalizedPoints(landmarks, handedness = 'Right') {
  const wrist = landmarks[0];
  let points = landmarks.map(p => ({ x: p.x - wrist.x, y: p.y - wrist.y, z: p.z - wrist.z }));
  if (handedness === 'Left') points = points.map(p => ({ ...p, x: -p.x }));
  const middleMcp = points[9];
  const angle = Math.atan2(middleMcp.x, -middleMcp.y);
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  points = points.map(p => ({ x: p.x*cos - p.y*sin, y: p.x*sin + p.y*cos, z: p.z }));
  const scale = Math.hypot(points[9].x, points[9].y, points[9].z) || 1;
  return points.map(p => ({ x: p.x/scale, y: p.y/scale, z: p.z/scale }));
}

function distance3d(a, b) {
  return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
}

function jointAngle(a, b, c) {
  const ab = { x:a.x-b.x, y:a.y-b.y, z:a.z-b.z };
  const cb = { x:c.x-b.x, y:c.y-b.y, z:c.z-b.z };
  const length = distance3d(a,b) * distance3d(c,b) || 1;
  const cosine = Math.max(-1, Math.min(1, (ab.x*cb.x + ab.y*cb.y + ab.z*cb.z)/length));
  return Math.acos(cosine) * 180/Math.PI;
}

function fingerIsExtended(points, [mcp, pip, dip, tip]) {
  return jointAngle(points[mcp], points[pip], points[dip]) > 145
    && jointAngle(points[pip], points[dip], points[tip]) > 135
    && distance3d(points[tip], points[0]) > distance3d(points[pip], points[0]) * 1.12;
}

// This classifier works immediately. It does not know gesture names through
// MediaPipe; it derives them from understandable finger positions.
function recognizeGesture(landmarks, handedness) {
  const points = normalizedPoints(landmarks, handedness);
  const index = fingerIsExtended(points, [5,6,7,8]);
  const middle = fingerIsExtended(points, [9,10,11,12]);
  const ring = fingerIsExtended(points, [13,14,15,16]);
  const pinky = fingerIsExtended(points, [17,18,19,20]);
  const extendedCount = [index,middle,ring,pinky].filter(Boolean).length;
  const thumbStraight = jointAngle(points[2], points[3], points[4]) > 140;
  const thumbVectorX = Math.abs(points[4].x-points[2].x);
  const thumbVectorY = points[2].y-points[4].y;
  const highestKnuckle = Math.min(points[5].y, points[9].y, points[13].y, points[17].y);
  const thumbFarFromPalm = distance3d(points[4], points[0]) > 1.15;
  const thumbIsVertical = thumbVectorY > 0.55 && thumbVectorX < thumbVectorY * 0.8;
  const thumbAboveKnuckles = points[4].y < highestKnuckle - 0.12;
  const clearThumbsUp = thumbStraight && thumbFarFromPalm && thumbIsVertical && thumbAboveKnuckles;
  const thumbTouchesIndex = distance3d(points[4], points[8]) < 0.38;

  // For the OK sign, thumb and index fingertip form a circle while the other
  // three fingers remain extended. Check it before the general open-hand rule.
  if (thumbTouchesIndex && middle && ring && pinky) return { label:'ok_sign', confidence:.96 };
  if (index && middle && !ring && !pinky) return { label:'peace', confidence:.94 };
  if (index && !middle && !ring && !pinky) return { label:'pointing', confidence:.92 };
  if (extendedCount === 0 && clearThumbsUp) return { label:'thumbs_up', confidence:.95 };
  if (extendedCount >= 3) return { label:'open_hand', confidence: extendedCount === 4 ? .96 : .88 };
  if (extendedCount === 0) return { label:'fist', confidence:.91 };
  return null;
}

function processTrainingFrame(result) {
  if (!state.recording || !result.landmarks[0]) return;
  const now = performance.now(); if (now - state.lastSampleAt < 90) return;
  const gesture = $('#gesture-select').value;
  if (countSamples(gesture) >= TARGET_SAMPLES) { stopRecording(); toast('100 Samples aufgenommen.'); return; }
  const features = extractFeatures(result.landmarks[0], result.handedness?.[0]?.[0]?.categoryName);
  const previous = [...state.samples].reverse().find(sample => sample.label === gesture);
  // Near-identical consecutive frames add little information, so skip them.
  if (previous && euclidean(features, previous.features) < 0.035) return;
  state.samples.push({ label: gesture, features }); state.lastSampleAt = now;
  saveSamples(); updateTrainingUi();
}

function countSamples(label) { return state.samples.filter(sample => sample.label === label).length; }
function updateTrainingUi() {
  const selected = $('#gesture-select').value, count = countSamples(selected);
  $('#sample-count').textContent = count; $('#sample-bar').style.width = `${Math.min(count, TARGET_SAMPLES)}%`;
  $('#class-overview').innerHTML = GESTURES.map(g => `<div class="class-row"><span>${g.emoji} ${g.name}</span><span>${countSamples(g.id)} Samples</span></div>`).join('');
  const readyClasses = GESTURES.filter(g => countSamples(g.id) >= 10).length;
  $('#train-button').disabled = readyClasses < 2;
}
function toggleRecording() {
  state.recording = !state.recording; $('#record-button').textContent = state.recording ? 'Aufnahme stoppen' : 'Aufnahme starten';
  $('#record-button').classList.toggle('accent', state.recording);
  $('#gesture-select').disabled = state.recording;
}
function stopRecording() { if (state.recording) toggleRecording(); }

function euclidean(a, b) {
  let sum = 0; for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / a.length);
}

function predict(features, trainingSamples = state.model?.samples || []) {
  if (!trainingSamples.length) return null;
  const neighbors = trainingSamples.map(s => ({ label: s.label, distance: euclidean(features, s.features) })).sort((a,b) => a.distance-b.distance).slice(0, Math.min(K_NEIGHBORS, trainingSamples.length));
  const votes = {};
  neighbors.forEach(n => { votes[n.label] = (votes[n.label] || 0) + 1/(n.distance + 0.001); });
  const total = Object.values(votes).reduce((a,b) => a+b, 0);
  const [label, score] = Object.entries(votes).sort((a,b) => b[1]-a[1])[0];
  return { label, confidence: score/total };
}

// KNN uses distances. Standardization prevents one feature with naturally
// larger values from dominating all other landmark values.
function fitScaler(samples) {
  const size = samples[0].features.length;
  const mean = Array(size).fill(0), deviation = Array(size).fill(0);
  samples.forEach(sample => sample.features.forEach((value, i) => { mean[i] += value; }));
  mean.forEach((_, i) => { mean[i] /= samples.length; });
  samples.forEach(sample => sample.features.forEach((value, i) => { deviation[i] += (value-mean[i])**2; }));
  // Very small deviations amplify camera noise, so keep a sensible minimum.
  deviation.forEach((_, i) => { deviation[i] = Math.max(Math.sqrt(deviation[i]/samples.length), 0.05); });
  return { mean, deviation };
}
function scaleFeatures(features, scaler) {
  return features.map((value, i) => (value-scaler.mean[i])/scaler.deviation[i]);
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}

function trainModel() {
  const rawTrain = [], rawTest = [];
  GESTURES.forEach(g => {
    const classSamples = shuffled(state.samples.filter(s => s.label === g.id));
    if (classSamples.length < 10) return;
    const testCount = Math.max(1, Math.floor(classSamples.length * .2));
    rawTest.push(...classSamples.slice(0, testCount)); rawTrain.push(...classSamples.slice(testCount));
  });
  if (new Set(rawTrain.map(s => s.label)).size < 2) return toast('Nimm mindestens 10 Samples für zwei Gesten auf.');
  const scaler = fitScaler(rawTrain);
  const train = rawTrain.map(s => ({ label: s.label, features: scaleFeatures(s.features, scaler) }));
  const test = rawTest.map(s => ({ label: s.label, features: scaleFeatures(s.features, scaler) }));
  let correct = 0;
  test.forEach(sample => { if (predict(sample.features, train)?.label === sample.label) correct++; });
  const accuracy = test.length ? correct/test.length : 0;
  state.model = { version: 2, samples: train, scaler, trainedAt: new Date().toISOString(), accuracy, totalSamples: state.samples.length };
  localStorage.setItem(MODEL_KEY, JSON.stringify(state.model)); updateModelUi(); toast('Modell erfolgreich trainiert.');
}

function updateModelUi() {
  if (!state.model) {
    $('#gesture-name').textContent = 'Zeig eine Handgeste';
    $('#model-summary').textContent = 'Soforterkennung aktiv · kein Training nötig';
    $('#go-to-training').hidden = true;
    return;
  }
  const accuracy = `${(state.model.accuracy*100).toFixed(1)} %`;
  $('#training-result').classList.remove('muted');
  $('#training-result').innerHTML = `<strong>Training complete</strong><br>Accuracy: ${accuracy}<br>Samples: ${state.model.totalSamples} (${state.model.samples.length} Training)`;
  $('#model-summary').textContent = 'Soforterkennung aktiv · kein Training nötig';
  $('#go-to-training').hidden = true;
}

function processLiveFrame(result) {
  if (!result.landmarks[0]) { state.predictionHistory = []; showPrediction(null, 'Keine Hand erkannt'); return; }
  const handedness = result.handedness?.[0]?.[0]?.categoryName;
  const prediction = recognizeGesture(result.landmarks[0], handedness);
  if (!prediction) return showPrediction(null, 'Unbekannte Geste');

  state.predictionHistory.push(prediction);
  if (state.predictionHistory.length > 7) state.predictionHistory.shift();
  const votes = {};
  state.predictionHistory.forEach(item => { votes[item.label] = (votes[item.label] || 0) + item.confidence; });
  const [stableLabel, stableScore] = Object.entries(votes).sort((a,b) => b[1]-a[1])[0];
  const stablePrediction = { label: stableLabel, confidence: stableScore/state.predictionHistory.length };
  if (stablePrediction.confidence < CONFIDENCE_THRESHOLD) {
    const candidate = GESTURES.find(g => g.id === prediction.label);
    showPrediction({ confidence: stablePrediction.confidence }, `Vielleicht: ${candidate?.name || 'unbekannt'}`);
  } else showPrediction(stablePrediction);
}

function showPrediction(prediction, overrideName) {
  const gesture = prediction?.label ? GESTURES.find(g => g.id === prediction.label) : null;
  const confidence = prediction?.confidence || 0;
  $('#gesture-emoji').textContent = gesture?.emoji || (overrideName === 'Unknown' ? '❔' : '—');
  $('#gesture-name').textContent = overrideName || gesture?.message || 'Unbekannte Geste';
  if ($('#confidence-value')) $('#confidence-value').textContent = `${Math.round(confidence*100)} %`;
  if ($('#confidence-bar')) $('#confidence-bar').style.width = `${confidence*100}%`;
}

function applyDemoAction(gesture) {
  const now = performance.now();
  if (gesture === state.lastActionGesture || now-state.lastActionAt < 900) return;
  state.lastActionGesture = gesture; state.lastActionAt = now;
  if (gesture === 'thumbs_up') { state.volume = Math.min(100, state.volume+10); $('#current-action').textContent = 'Volume +'; }
  else if (gesture === 'fist') { state.volume = Math.max(0, state.volume-10); $('#current-action').textContent = 'Volume −'; }
  else if (gesture === 'peace') { state.playing = !state.playing; $('#current-action').textContent = state.playing ? 'Play' : 'Pause'; }
  else { $('#current-action').textContent = 'Keine Aktion zugeordnet'; }
  updatePlayer();
  setTimeout(() => { if (state.lastActionGesture === gesture) state.lastActionGesture = null; }, 700);
}
function updatePlayer() {
  $('#volume-bar').style.width = `${state.volume}%`; $('#volume-value').textContent = `${state.volume}%`; $('#play-toggle').textContent = state.playing ? '❚❚' : '▶';
}

function initialize() {
  startCamera('live');
  // Some browsers require one user gesture before opening the camera. A click
  // anywhere retries the start, without adding a visible button to the UI.
  document.addEventListener('click', () => {
    if (!state.streams.has('live')) startCamera('live');
  });
}
initialize();
