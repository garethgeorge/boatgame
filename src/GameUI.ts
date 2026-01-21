import { GameThrottle } from './GameThrottle';

export interface GameUIListeners {
    onStart: () => Promise<void>;
    getBoatThrottle: () => number;
    setBoatThrottle: (val: number) => void;
    isPaused: () => boolean;
}

export class GameUI {
    container: HTMLElement;
    startScreen: HTMLElement;
    startBtn: HTMLElement;
    instructionsOverlay: HTMLElement;
    instructionsContent: HTMLElement;
    scoreElement: HTMLElement;
    gameThrottle: GameThrottle;
    fuelElement: HTMLElement;

    constructor(listeners: GameUIListeners) {
        this.container = document.getElementById('game-container') as HTMLElement;
        this.startScreen = document.getElementById('start-screen') as HTMLElement;
        this.startBtn = document.getElementById('start-btn') as HTMLElement;
        this.instructionsOverlay = document.getElementById('instructions-overlay') as HTMLElement;
        this.instructionsContent = document.getElementById('instructions-content') as HTMLElement;
        this.scoreElement = document.getElementById('score') as HTMLElement;
        this.fuelElement = document.getElementById('fuel-display') as HTMLElement;

        this.gameThrottle = new GameThrottle(
            'throttle-container',
            'throttle-thumb',
            (val) => listeners.setBoatThrottle(val),
            () => listeners.getBoatThrottle(),
            () => listeners.isPaused()
        );

        this.startBtn.addEventListener('click', async (e) => {
            console.log('[DEBUG] Start button clicked');
            e.stopPropagation();
            e.stopImmediatePropagation();
            await listeners.onStart();
        });

        // Disable start button until initialization is complete
        this.startBtn.style.visibility = 'hidden';

        // Check for touch device to update UI text
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            const instructions = document.createElement('p');
            instructions.innerText = "Tap Start to Enable Tilt Controls";
            instructions.style.color = "#aaa";
            instructions.style.fontSize = "14px";
            instructions.style.marginTop = "10px";
            this.startScreen.appendChild(instructions);
        }
    }

    public setStartButtonVisible(visible: boolean) {
        if (visible) {
            this.startBtn.style.visibility = 'visible';
            this.startBtn.style.opacity = '1';
        } else {
            this.startBtn.style.visibility = 'hidden';
            this.startBtn.style.opacity = '0';
        }
    }

    public hideStartScreen() {
        this.startScreen.style.display = 'none';
    }

    public showInstructions(url: string, onDismiss: () => void) {
        console.log('[DEBUG] showInstructions() called with url:', url);
        this.instructionsOverlay.style.display = 'flex';
        this.loadInstructionsContent(url, onDismiss);
    }

    private async loadInstructionsContent(url: string, onDismiss: () => void) {
        console.log(`Fetching instructions from: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            this.instructionsContent.innerHTML = html;

            const dismissBtn = document.getElementById('dismiss-instructions-btn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    this.dismissInstructions(onDismiss);
                });
            } else {
                console.warn("Dismiss button not found in instructions HTML");
            }
        } catch (e) {
            console.error("Failed to load instructions:", e);
            this.instructionsContent.innerHTML = `<p style="color:white">Failed to load instructions. <br> ${e}</p> <button id="error-dismiss">Dismiss</button>`;
            const errorDismiss = document.getElementById('error-dismiss');
            if (errorDismiss) errorDismiss.addEventListener('click', () => this.dismissInstructions(onDismiss));
        }
    }

    private dismissInstructions(onDismiss: () => void) {
        console.log('[DEBUG] dismissInstructions() called');
        this.instructionsOverlay.style.display = 'none';
        this.instructionsContent.innerHTML = '';
        onDismiss();
    }

    public updateScore(score: number) {
        this.scoreElement.innerText = `Score: ${score} `;
    }

    public updateThrottleVisuals(val: number) {
        this.gameThrottle.updateVisuals(val);
    }
}
