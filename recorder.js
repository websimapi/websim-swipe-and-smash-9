let recording = [];
let initialState = null;
let startTime = 0;

export function startRecording(boardGrid) {
    if (startTime > 0) return; // Already started
    recording = [];
    startTime = Date.now();
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
}

export function recordAction(action) {
    if (startTime === 0) return; // Don't record if not started
    // action = { type: 'swap', from: {r,c}, to: {r,c} }
    // action = { type: 'smash', from: {r,c} }
    const timestamp = Date.now() - startTime;
    recording.push({ ...action, timestamp });
}

export function recordSound(soundName) {
    const timestamp = Date.now() - startTime;
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