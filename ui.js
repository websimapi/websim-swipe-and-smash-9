export default class UI {
    constructor() {
        this.scoreElement = document.getElementById('score');
        this.comboDisplay = document.getElementById('combo-display');
        this.smashValueElement = document.getElementById('smash-value');
        this.smashFluidElement = document.getElementById('smash-fluid');
        this.timerElement = document.getElementById('timer');
        this.startOverlay = document.getElementById('start-overlay');
        this.startButton = document.getElementById('start-button');
        
        this.comboTimeout = null;
    }

    setup(startGameCallback) {
        this.startButton.addEventListener('click', startGameCallback);
    }

    updateScore(score) {
        this.scoreElement.textContent = score;
        // Also update the score in the footer for consistency
        const scoreDisplays = document.querySelectorAll('#score');
        scoreDisplays.forEach(el => el.textContent = score);
    }

    updateTimer(time) {
        this.timerElement.textContent = time;
    }

    updateCombo(comboCount) {
        if (comboCount < 2) return;

        this.comboDisplay.textContent = `Combo x${comboCount}`;
        this.comboDisplay.classList.add('visible');

        clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => {
            this.comboDisplay.classList.remove('visible');
        }, 1500);
    }

    updateSmash(smashValue, smashProgress) {
        this.smashValueElement.textContent = smashValue;
        const fillPercentage = smashProgress * 100;
        this.smashFluidElement.style.height = `${fillPercentage}%`;
    }
    
    animateSmashFill(onFillComplete) {
        this.smashFluidElement.style.transition = 'height 0.3s ease-in';
        this.smashFluidElement.style.height = '100%';
        setTimeout(() => {
            onFillComplete();
            setTimeout(() => {
                this.smashFluidElement.style.transition = 'height 0.5s ease-out';
                // The updateSmash call after this will reset the height
            }, 200);
        }, 300);
    }

    hideStartOverlay() {
        this.startOverlay.classList.add('hidden');
    }
}