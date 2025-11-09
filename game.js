import Board from './board.js';
import InputHandler from './input.js';
import Replay from './replay.js';
import UI from './ui.js';
import GameState from './state.js';
import { playSound, pauseBackgroundMusic, resumeBackgroundMusic } from './audio.js';
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
        this.state = new GameState(config);
        this.ui = new UI();
        this.board = new Board(config.boardSize, config.candyTypes, this.onMatch.bind(this), this.getNewCandyType.bind(this));
        
        this.isRecordingStarted = false;
        
        this.replay = new Replay(this, config);
        this.inputHandler = new InputHandler(this.board.boardElement, this.onSwap.bind(this), this.onSmash.bind(this));
        
        this.ui.setup(this.startGame.bind(this));
        this.ui.updateScore(this.state.score);
        this.ui.updateSmash(this.state.smashValue, this.state.smashProgress);
        this.initializeBoard();
    }

    initializeBoard() {
        // Pre-generate initial state so we can record it before the game starts
        const initialState = [];
        for (let r = 0; r < config.boardSize; r++) {
            initialState[r] = [];
            for (let c = 0; c < config.boardSize; c++) {
                initialState[r][c] = this.getNewCandyType(true); // isInitial is true
            }
        }
        this.board.initialize(initialState);
    }

    getNewCandyType(isInitial = false) {
        const type = config.candyTypes[Math.floor(Math.random() * config.candyTypes.length)];
        
        if (!isInitial && this.isRecordingStarted) {
            recorder.recordAction({ type: 'newCandy', candyType: type });
        }
        return type;
    }

    startGame() {
        if (this.state.isGameStarted) return;
        this.state.startGame();

        this.ui.hideStartOverlay();
        
        // This is a direct audio call, but it's a one-off for starting BGM.
        // It's acceptable to keep it here for simplicity.
        import('./audio.js').then(audio => audio.playBackgroundMusic());

        recorder.startRecording(this.board.grid);
        this.isRecordingStarted = true;

        this.startTimer();
        this.inputHandler.enable();
    }
    
    startTimer() {
        this.state.startTimer(
            (time) => this.ui.updateTimer(time),
            () => { // onEnd callback
                recorder.resetRecording();
                this.isRecordingStarted = false;
                this.ui.updateSmash(this.state.smashValue, this.state.smashProgress);
            }
        );
        this.ui.updateTimer(this.state.timerValue);
    }

    pauseTimer() {
        this.state.pauseTimer();
    }

    resumeTimer() {
        this.state.resumeTimer();
    }

    // Add BGM control methods for the replay module to call
    pauseMainBGM() {
        pauseBackgroundMusic();
    }

    resumeMainBGM() {
        resumeBackgroundMusic();
    }

    onMatch(matchedCandies, isPlayerMove) {
        playSound('match.mp3');
        recorder.recordSound('match.mp3');
        const newScore = this.state.addScore(matchedCandies.length * config.pointsPerCandy);
        this.ui.updateScore(newScore);
        
        const comboCount = this.state.incrementCombo();
        this.ui.updateCombo(comboCount);

        // Audio feedback
        if (comboCount === 6) {
            playSound('combo_6.mp3');
            recorder.recordSound('combo_6.mp3');
        } else if (comboCount === 7) {
            playSound('combo_7.mp3');
            recorder.recordSound('combo_7.mp3');
        } else if (comboCount > 2) {
             playSound('crunch_combo.mp3');
             recorder.recordSound('crunch_combo.mp3');
        } else if (isPlayerMove) {
            const randomSound = POSITIVE_FEEDBACK_SOUNDS[Math.floor(Math.random() * POSITIVE_FEEDBACK_SOUNDS.length)];
            playSound(randomSound);
            recorder.recordSound(randomSound);
        }
        
        if (isPlayerMove) {
            const newProgress = this.state.processPlayerMove();
            this.ui.updateTimer(this.state.timerValue); // Timer was reset
            this.ui.updateSmash(this.state.smashValue, newProgress);

            if (newProgress >= 1) {
                this.ui.animateSmashFill(() => {
                    const newSmashValue = this.state.levelUpSmash();
                    this.ui.updateSmash(newSmashValue, this.state.smashProgress);
                });
            }
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
        if (this.state.isProcessing || this.state.smashValue <= 0) return;
        this.state.isProcessing = true;
        this.pauseTimer();

        const r = parseInt(candy.dataset.row);
        const c = parseInt(candy.dataset.col);
        const candiesToSmash = new Set();
        let smashCost = 0;

        if (this.state.smashValue >= 7) { // Simplified ranges
            // 3x3 area
            for (let i = r - 1; i <= r + 1; i++) for (let j = c - 1; j <= c + 1; j++) if (this.board.isValid(i, j) && this.board.grid[i][j]) candiesToSmash.add(this.board.grid[i][j]);
            smashCost = 3;
        } else if (this.state.smashValue >= 4) {
            // 2x2 area
            for (let i = r; i <= r + 1; i++) for (let j = c; j <= c + 1; j++) if (this.board.isValid(i, j) && this.board.grid[i][j]) candiesToSmash.add(this.board.grid[i][j]);
            smashCost = 2;
        } else {
            // 1x1
            candiesToSmash.add(candy);
            smashCost = 1;
        }
        
        if (!this.state.useSmash(smashCost)) {
            this.state.isProcessing = false;
            this.resumeTimer();
            return;
        }
        
        const smashedCoords = Array.from(candiesToSmash).map(c => ({ r: parseInt(c.dataset.row), c: parseInt(c.dataset.col) }));
        if (this.isRecordingStarted) recorder.recordAction({ type: 'smash', smashed: smashedCoords });

        this.ui.updateSmash(this.state.smashValue, this.state.smashProgress);
        playSound('smash.mp3');
        recorder.recordSound('smash.mp3');
        
        await this.board.smashCandies(Array.from(candiesToSmash));

        this.state.isProcessing = false;
        this.resumeTimer();
    }

    async onSwap(candy1, candy2) {
        if (this.state.isProcessing) return;
        this.state.isProcessing = true;
        this.pauseTimer();
        this.state.resetCombo();
        
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
            
            await this.board.activateRainbowPowerup(rainbowCandy, otherCandy);
            this.state.isProcessing = false;
            this.resumeTimer();
            return;
        }
        
        await this.board.swapCandies(candy1, candy2);
        const isValidSwap = await this.board.processMatches(false, [candy1, candy2]);

        if (!isValidSwap) {
            await this.board.swapCandies(candy1, candy2);
        }
        
        this.state.isProcessing = false;
        this.resumeTimer();
    }
}

window.addEventListener('load', () => {
    new Game();
});