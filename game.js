import Board from './board.js';
import InputHandler from './input.js';
import { playSound, pauseBackgroundMusic, resumeBackgroundMusic, stopBackgroundMusic, playBackgroundMusic } from './audio.js';
import * as recorder from './recorder.js';
import confetti from 'confetti';

const config = {
    boardSize: 10,
    candyTypes: [
        'candy_red.png',
        'candy_blue.png',
        'candy_green.png',
        'candy_yellow.png',
        'candy_purple.png',
        'candy_orange.png'
    ],
    pointsPerCandy: 10,
    timerDuration: 15,
    initialSmashValue: 0
};

const POSITIVE_FEEDBACK_SOUNDS = [
    'nice_swipe.mp3',
    'tasty_trio.mp3',
    'good_move.mp3'
];

class Game {
    constructor() {
        this.board = new Board(config.boardSize, config.candyTypes, this.onMatch.bind(this));
        this.score = 0;
        this.scoreElement = document.getElementById('score');
        this.isProcessing = false;
        this.isGameStarted = false;

        this.comboCount = 0;
        this.comboDisplay = document.getElementById('combo-display');
        this.comboTimeout = null;

        this.smashValue = config.initialSmashValue;
        this.smashProgress = 0; // 0, 0.5
        this.smashValueElement = document.getElementById('smash-value');
        this.smashFluidElement = document.getElementById('smash-fluid');
        this.timerValue = config.timerDuration;
        this.timerElement = document.getElementById('timer');
        this.timerInterval = null;
        this.isTimerPaused = false;
        this.replayTimeouts = [];
        this.isRecordingStarted = false;
        this.replayState = {
            isPlaying: false,
            isPaused: false,
            pauseTime: 0,
            startTime: 0,
            actions: [],
        };
        
        this.inputHandler = new InputHandler(this.board.boardElement, this.onSwap.bind(this), this.onSmash.bind(this));
        
        this.setupUI();
        this.updateScore(0);
        this.updateSmashUI();
        this.board.initialize();
    }

    startGame() {
        if (this.isGameStarted) return;
        this.isGameStarted = true;

        document.getElementById('start-overlay').classList.add('hidden');
        
        playBackgroundMusic();
        recorder.startRecording(this.board.grid);
        this.isRecordingStarted = true;

        this.startTimer();
        this.inputHandler.enable();
    }

    setupUI() {
        document.getElementById('start-button').addEventListener('click', () => this.startGame());
        document.getElementById('clip-button').addEventListener('click', () => this.showReplay());
        document.getElementById('close-replay-button').addEventListener('click', () => this.hideReplay());
        document.getElementById('play-pause-button').addEventListener('click', () => this.toggleReplayPlayback());
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (this.isTimerPaused) return;

            this.timerValue--;
            this.timerElement.textContent = this.timerValue;
            if (this.timerValue <= 0) {
                if (this.smashValue > 0) {
                    this.smashValue--;
                    this.updateSmashUI();
                } else {
                    // Game over / round over condition
                    recorder.resetRecording();
                    this.isRecordingStarted = false;
                }
                this.smashProgress = 0; // Reset progress if timer runs out
                this.updateSmashUI();
                this.resetTimer();
            }
        }, 1000);
    }

    resetTimer() {
        this.timerValue = config.timerDuration;
        this.timerElement.textContent = this.timerValue;
    }

    pauseTimer() {
        this.isTimerPaused = true;
    }

    resumeTimer() {
        this.isTimerPaused = false;
    }

    updateComboUI() {
        if (this.comboCount < 2) return;

        this.comboDisplay.textContent = `Combo x${this.comboCount}`;
        this.comboDisplay.classList.add('visible');

        clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => {
            this.comboDisplay.classList.remove('visible');
        }, 1500);
    }

    updateSmashUI() {
        this.smashValueElement.textContent = this.smashValue;
        const fillPercentage = this.smashProgress * 100; // 0 or 50
        this.smashFluidElement.style.height = `${fillPercentage}%`;
    }

    updateScore(points) {
        this.score += points;
        this.scoreElement.textContent = this.score;
    }

    onMatch(matchedCandies, isPlayerMove) {
        playSound('match.mp3');
        recorder.recordSound('match.mp3');
        this.updateScore(matchedCandies.length * config.pointsPerCandy);
        
        this.comboCount++;
        this.updateComboUI();

        // Audio feedback
        if (this.comboCount === 6) {
            playSound('combo_6.mp3');
            recorder.recordSound('combo_6.mp3');
        } else if (this.comboCount === 7) {
            playSound('combo_7.mp3');
            recorder.recordSound('combo_7.mp3');
        } else if (this.comboCount > 2) {
             playSound('crunch_combo.mp3');
             recorder.recordSound('crunch_combo.mp3');
        } else if (isPlayerMove) {
            const randomSound = POSITIVE_FEEDBACK_SOUNDS[Math.floor(Math.random() * POSITIVE_FEEDBACK_SOUNDS.length)];
            playSound(randomSound);
            recorder.recordSound(randomSound);
        }
        
        if (isPlayerMove) {
            this.smashProgress += 0.5;
            this.updateSmashUI();

            if (this.smashProgress >= 1) {
                // Animate fill, update value, then animate empty
                this.smashFluidElement.style.transition = 'height 0.3s ease-in';
                this.smashFluidElement.style.height = '100%';

                setTimeout(() => {
                    if (this.smashValue < 12) {
                        this.smashValue++;
                    }
                    this.smashValueElement.textContent = this.smashValue;
                    this.smashProgress = 0;
                    
                    setTimeout(() => {
                        this.smashFluidElement.style.transition = 'height 0.5s ease-out';
                        this.updateSmashUI();
                    }, 200); // Wait a moment before draining
                }, 300); // Duration of the fill animation
            }
            
            this.resetTimer();
        }

        if (matchedCandies.length >= 5) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }

    async onSmash(candy) {
        if (this.isProcessing || this.smashValue <= 0) return;
        this.isProcessing = true;
        this.pauseTimer();

        const r = parseInt(candy.dataset.row);
        const c = parseInt(candy.dataset.col);
        const candiesToSmash = new Set();
        let smashCost = 0;

        if (this.smashValue >= 7 && this.smashValue <= 12) {
            // 3x3 area centered on the candy
            for (let i = r - 1; i <= r + 1; i++) {
                for (let j = c - 1; j <= c + 1; j++) {
                    if (this.board.isValid(i, j) && this.board.grid[i][j]) {
                        candiesToSmash.add(this.board.grid[i][j]);
                    }
                }
            }
            smashCost = 3;
        } else if (this.smashValue >= 4 && this.smashValue <= 6) {
            // 2x2 area starting from the candy (top-left)
            for (let i = r; i <= r + 1; i++) {
                for (let j = c; j <= c + 1; j++) {
                    if (this.board.isValid(i, j) && this.board.grid[i][j]) {
                        candiesToSmash.add(this.board.grid[i][j]);
                    }
                }
            }
            smashCost = 2;
        } else if (this.smashValue >= 1 && this.smashValue <= 3) {
            candiesToSmash.add(candy);
            smashCost = 1;
        }

        if (this.smashValue < smashCost || smashCost === 0) {
            this.isProcessing = false;
            this.resumeTimer();
            return;
        }
        
        if (this.isRecordingStarted) recorder.recordAction({ type: 'smash', from: { r, c } });

        this.smashValue -= smashCost;
        this.updateSmashUI();
        playSound('smash.mp3');
        recorder.recordSound('smash.mp3');
        
        // Pass a flag to indicate this is a smash action
        await this.board.smashCandies(Array.from(candiesToSmash));

        this.isProcessing = false;
        this.resumeTimer();
    }

    async onSwap(candy1, candy2) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.pauseTimer();
        this.comboCount = 0; // Reset combo on new player move
        
        const r1 = parseInt(candy1.dataset.row);
        const c1 = parseInt(candy1.dataset.col);
        const r2 = parseInt(candy2.dataset.row);
        const c2 = parseInt(candy2.dataset.col);
        if (this.isRecordingStarted) recorder.recordAction({ type: 'swap', from: { r: r1, c: c1 }, to: { r: r2, c: c2 } });

        const candy1Powerup = candy1.dataset.powerup;
        const candy2Powerup = candy2.dataset.powerup;

        if (candy1Powerup === 'rainbow' || candy2Powerup === 'rainbow') {
            const rainbowCandy = candy1Powerup === 'rainbow' ? candy1 : candy2;
            const otherCandy = candy1Powerup === 'rainbow' ? candy2 : candy1;
            
            // We don't need to swap visually, just activate
            await this.board.activateRainbowPowerup(rainbowCandy, otherCandy);
            this.isProcessing = false;
            this.resumeTimer();
            return;
        }
        
        await this.board.swapCandies(candy1, candy2);
        const isValidSwap = await this.board.processMatches(false, [candy1, candy2]);

        if (!isValidSwap) {
            // If no matches, swap back
            await this.board.swapCandies(candy1, candy2);
        }
        
        this.isProcessing = false;
        this.resumeTimer();
    }

    showReplay() {
        this.pauseTimer();
        pauseBackgroundMusic();
        if (this.isRecordingStarted) {
            recorder.pauseRecording();
        }
        const modal = document.getElementById('replay-modal');
        modal.classList.remove('hidden');
        this.playReplay();
    }

    hideReplay() {
        const modal = document.getElementById('replay-modal');
        modal.classList.add('hidden');
        this.pauseReplay(); // Also stops bgm
        if (this.isRecordingStarted) {
            recorder.resumeRecording();
        }
        resumeBackgroundMusic();
        this.resumeTimer();
    }

    async playReplay() {
        const playPauseButton = document.getElementById('play-pause-button');

        if (this.replayState.isPaused) {
            this.resumeReplay();
            return;
        }

        const recording = recorder.getRecording();
        if (!recording || !recording.initialState) return;

        this.replayTimeouts.forEach(clearTimeout);
        this.replayTimeouts = [];

        const replayBoardElement = document.getElementById('replay-board');
        replayBoardElement.innerHTML = ''; // Clear previous replay
        
        const replayBoard = new Board(config.boardSize, config.candyTypes, () => {});
        replayBoard.boardElement = replayBoardElement;
        replayBoard.setupBoard();
        replayBoard.initialize(recording.initialState);
        
        let replayBgmPlaying = false;

        this.replayState.isPlaying = true;
        this.replayState.isPaused = false;
        this.replayState.startTime = performance.now();
        this.replayState.actions = [...recording.actions];
        playPauseButton.innerHTML = '&#10074;&#10074;'; // Pause icon
        playPauseButton.classList.remove('playing');

        this.scheduleReplayActions(replayBoard);
    }

    scheduleReplayActions(replayBoard) {
        this.replayTimeouts.forEach(clearTimeout);
        this.replayTimeouts = [];

        const elapsedTime = this.replayState.isPaused ? this.replayState.pauseTime : 0;
        this.replayState.startTime = performance.now() - elapsedTime;

        this.replayState.actions.forEach(action => {
            const delay = action.timestamp - elapsedTime;
            if (delay < 0) return; // Action already happened

            const timeoutId = setTimeout(async () => {
                if (action.type === 'swap') {
                    const candy1 = replayBoard.grid[action.from.r][action.from.c];
                    const candy2 = replayBoard.grid[action.to.r][action.to.c];
                    if(candy1 && candy2) {
                        await replayBoard.swapCandies(candy1, candy2);
                        const isValid = await replayBoard.processMatches(false, [candy1, candy2]);
                        if(!isValid) {
                             await replayBoard.swapCandies(candy1, candy2);
                        }
                    }
                } else if (action.type === 'smash') {
                    const candy = replayBoard.grid[action.from.r][action.from.c];
                    if (candy) {
                       const toSmash = [candy];
                       await replayBoard.smashCandies(toSmash);
                    }
                } else if (action.type === 'sound') {
                    playSound(action.name);
                } else if (action.type === 'startBGM' && !this.replayBgmControl) {
                    this.replayBgmControl = await playBackgroundMusic(true); // Start BGM for replay
                }
            }, delay);
            this.replayTimeouts.push(timeoutId);
        });

        const recordingDuration = this.replayState.actions.length > 0 ? this.replayState.actions[this.replayState.actions.length - 1].timestamp : 0;
        const endTimeoutDelay = recordingDuration - elapsedTime + 2000;
        if (endTimeoutDelay > 0) {
            const endTimeout = setTimeout(() => {
                this.stopReplay();
            }, endTimeoutDelay);
            this.replayTimeouts.push(endTimeout);
        }
    }

    toggleReplayPlayback() {
        if (this.replayState.isPlaying) {
            if (this.replayState.isPaused) {
                this.resumeReplay();
            } else {
                this.pauseReplay();
            }
        }
    }

    pauseReplay() {
        if (!this.replayState.isPlaying || this.replayState.isPaused) return;

        this.replayTimeouts.forEach(clearTimeout);
        this.replayTimeouts = [];
        this.replayState.isPaused = true;
        this.replayState.pauseTime = performance.now() - this.replayState.startTime;
        if (this.replayBgmControl && this.replayBgmControl.pause) {
            this.replayBgmControl.pause();
        }
        
        const playPauseButton = document.getElementById('play-pause-button');
        playPauseButton.innerHTML = '&#9658;'; // Play icon
        playPauseButton.classList.remove('playing');
    }
    
    resumeReplay() {
        if (!this.replayState.isPaused) return;
        
        this.replayState.isPaused = false;
        
        if (this.replayBgmControl && this.replayBgmControl.resume) {
            this.replayBgmControl.resume();
        }
        
        const replayBoardElement = document.getElementById('replay-board');
        const replayBoard = new Board(config.boardSize, config.candyTypes, () => {});
        replayBoard.boardElement = replayBoardElement;
        
        // This is a simplification; for perfect resume, we'd need to reconstruct board state
        // But for now, just rescheduling future events is good enough.
        const recording = recorder.getRecording();
        replayBoard.initialize(recording.initialState);
        // This is not perfect as it re-inits the board visually. A better impl would reconstruct state.
        // For now, let's just replay from where we left off.

        this.scheduleReplayActions(replayBoard);

        const playPauseButton = document.getElementById('play-pause-button');
        playPauseButton.innerHTML = '&#10074;&#10074;'; // Pause icon
        playPauseButton.classList.add('playing');
    }

    stopReplay() {
        this.replayTimeouts.forEach(clearTimeout);
        this.replayTimeouts = [];
        if (this.replayBgmControl) {
            this.replayBgmControl.stop();
            this.replayBgmControl = null;
        }
        this.replayState = { isPlaying: false, isPaused: false, pauseTime: 0, startTime: 0, actions: [] };
        
        const playPauseButton = document.getElementById('play-pause-button');
        playPauseButton.innerHTML = '&#9658;'; // Play icon
        playPauseButton.classList.remove('playing');
        
        // Optionally, close the modal automatically
        // this.hideReplay();
    }
}

window.addEventListener('load', () => {
    new Game();
});