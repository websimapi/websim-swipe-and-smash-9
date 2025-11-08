let recording = [];
let initialState = null;
let startTime = 0;

export function startRecording(boardGrid) {
    recording = [];
    startTime = Date.now();
    // Deep copy of the initial candy types, not the elements
    initialState = boardGrid.map(row => 
        row.map(candy => candy ? candy.dataset.type : null)
    );
}

export function recordAction(action) {
    // action = { type: 'swap', from: {r,c}, to: {r,c} }
    // action = { type: 'smash', from: {r,c} }
    const timestamp = Date.now() - startTime;
    recording.push({ ...action, timestamp });
}

export function getRecording() {
    return {
        initialState: initialState,
        actions: recording
    };
}