let recording = [];
let initialState = null;
let startTime = 0;
let isPaused = false;
let totalPausedDuration = 0;
let pauseStartTime = 0;

export function startRecording(boardGrid) {
    if (startTime > 0) return; // Already started
    recording = [];
    startTime = Date.now();
    isPaused = false;
    totalPausedDuration = 0;
    pauseStartTime = 0;
    // Deep copy of the initial candy types, not the elements
    initialState = boardGrid.map(row => 
        row.map(candy => candy ? candy.dataset.type : null)
    );
    // Record that BGM starts at the beginning
    recordAction({ type: 'startBGM' });
}

export function resetRecording() {
    recording = [];
    initialState = null;
    startTime = 0;
    isPaused = false;
    totalPausedDuration = 0;
    pauseStartTime = 0;
}

export function pauseRecording() {
    if (!isPaused && startTime > 0) {
        isPaused = true;
        pauseStartTime = Date.now();
    }
}

export function resumeRecording() {
    if (isPaused && startTime > 0) {
        totalPausedDuration += Date.now() - pauseStartTime;
        isPaused = false;
        pauseStartTime = 0;
    }
}

function getTimestamp() {
    // If we're paused, we should not be calling this, but as a fallback,
    // let's calculate timestamp as if it was at the moment of pausing.
    if (isPaused) {
        return pauseStartTime - startTime - totalPausedDuration;
    }
    return Date.now() - startTime - totalPausedDuration;
}

export function recordAction(action) {
    if (startTime === 0 || isPaused) return; // Don't record if not started or if paused
    // action = { type: 'swap', from: {r,c}, to: {r,c} }
    // action = { type: 'smash', from: {r,c} }
    const timestamp = getTimestamp();
    recording.push({ ...action, timestamp });
}

export function recordSound(soundName) {
    if (startTime === 0 || isPaused) return; // Don't record if not started or if paused
    const timestamp = getTimestamp();
    recording.push({ type: 'sound', name: soundName, timestamp });
}

export function getRecording() {
    if (recording) {
        // Sort by timestamp to ensure actions and sounds are in order
        recording.sort((a, b) => a.timestamp - b.timestamp);
    }
    return {
        initialState: initialState,
        actions: recording
    };
}