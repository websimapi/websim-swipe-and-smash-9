export default class GameState {
    constructor(config) {
        this.config = config;
        this.score = 0;
        this.comboCount = 0;
        this.smashValue = config.initialSmashValue;
        this.smashProgress = 0;
        this.timerValue = config.timerDuration;
        this.timerInterval = null;
        this.isTimerPaused = false;
        this.isGameStarted = false;
        this.isProcessing = false;
    }

    startGame() {
        this.isGameStarted = true;
    }

    addScore(points) {
        this.score += points;
        return this.score;
    }

    incrementCombo() {
        this.comboCount++;
        return this.comboCount;
    }

    resetCombo() {
        this.comboCount = 0;
    }

    processPlayerMove() {
        this.smashProgress += 0.5;
        this.resetTimer();
        return this.smashProgress;
    }

    levelUpSmash() {
        if (this.smashValue < 12) {
            this.smashValue++;
        }
        this.smashProgress = 0;
        return this.smashValue;
    }
    
    useSmash(cost) {
        if (this.smashValue >= cost) {
            this.smashValue -= cost;
            return true;
        }
        return false;
    }

    startTimer(onTick, onEnd) {
        this.timerInterval = setInterval(() => {
            if (this.isTimerPaused) return;

            this.timerValue--;
            onTick(this.timerValue);
            
            if (this.timerValue <= 0) {
                if (this.smashValue > 0) {
                    this.smashValue--;
                } else {
                    onEnd();
                }
                this.smashProgress = 0;
                this.resetTimer();
            }
        }, 1000);
    }

    resetTimer() {
        this.timerValue = this.config.timerDuration;
    }
    
    pauseTimer() {
        this.isTimerPaused = true;
    }
    
    resumeTimer() {
        this.isTimerPaused = false;
    }
}

