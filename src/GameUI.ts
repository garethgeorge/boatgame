import { GameThrottle } from './GameThrottle';
import { DebugSettings } from './core/DebugSettings';
import { Profiler } from './core/Profiler';
import { DebugConsole } from './core/DebugConsole';

export interface GameUIListeners {
    onStart: () => Promise<void>;
    getBoatThrottle: () => number;
    setBoatThrottle: (val: number) => void;
    isPaused: () => boolean;
    onResetInstructions: () => void;
    onSetMobileOverride: (isMobile: boolean | null) => void;
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
    debugMenu: HTMLElement;

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

        this.debugMenu = document.getElementById('debug-menu') as HTMLElement;
        this.initDebugMenu(listeners);
    }

    private initDebugMenu(listeners: GameUIListeners) {
        if (!this.debugMenu) return;

        const geometryToggle = document.getElementById('debug-geometry') as HTMLInputElement;
        const profilerToggle = document.getElementById('debug-profiler') as HTMLInputElement;
        const consoleToggle = document.getElementById('debug-console') as HTMLInputElement;
        const resetBtn = document.getElementById('debug-reset-instructions') as HTMLButtonElement;
        const mobileSelect = document.getElementById('debug-mobile-mode') as HTMLSelectElement;
        const cycleSpeedSlider = document.getElementById('debug-cycle-speed') as HTMLInputElement;
        const cycleSpeedVal = document.getElementById('debug-cycle-speed-val') as HTMLElement;

        geometryToggle.checked = DebugSettings.geometryVisible;
        profilerToggle.checked = DebugSettings.profilerVisible;
        consoleToggle.checked = DebugSettings.debugConsoleVisible;

        geometryToggle.addEventListener('change', () => {
            DebugSettings.geometryVisible = geometryToggle.checked;
        });

        profilerToggle.addEventListener('change', () => {
            DebugSettings.profilerVisible = profilerToggle.checked;
            Profiler.setVisibility(DebugSettings.profilerVisible);
        });

        consoleToggle.addEventListener('change', () => {
            DebugSettings.debugConsoleVisible = consoleToggle.checked;
            DebugConsole.setVisibility(DebugSettings.debugConsoleVisible);
        });

        resetBtn.addEventListener('click', () => {
            listeners.onResetInstructions();
            alert('Instructions reset!');
        });

        mobileSelect.addEventListener('change', () => {
            const val = mobileSelect.value;
            if (val === 'auto') listeners.onSetMobileOverride(null);
            else if (val === 'mobile') listeners.onSetMobileOverride(true);
            else if (val === 'desktop') listeners.onSetMobileOverride(false);
        });

        if (cycleSpeedSlider && cycleSpeedVal) {
            cycleSpeedSlider.value = DebugSettings.cycleSpeedMultiplier.toString();
            cycleSpeedVal.innerText = `${DebugSettings.cycleSpeedMultiplier}x`;

            cycleSpeedSlider.addEventListener('input', () => {
                const val = parseFloat(cycleSpeedSlider.value);
                DebugSettings.cycleSpeedMultiplier = val;
                cycleSpeedVal.innerText = `${val}x`;
            });
        }
    }

    public toggleDebugMenu() {
        DebugSettings.debugMenuVisible = !DebugSettings.debugMenuVisible;
        this.debugMenu.style.display = DebugSettings.debugMenuVisible ? 'flex' : 'none';

        if (DebugSettings.debugMenuVisible) {
            const geometryToggle = document.getElementById('debug-geometry') as HTMLInputElement;
            const profilerToggle = document.getElementById('debug-profiler') as HTMLInputElement;
            const consoleToggle = document.getElementById('debug-console') as HTMLInputElement;

            if (geometryToggle) geometryToggle.checked = DebugSettings.geometryVisible;
            if (profilerToggle) profilerToggle.checked = DebugSettings.profilerVisible;
            if (consoleToggle) consoleToggle.checked = DebugSettings.debugConsoleVisible;
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
        this.instructionsOverlay.classList.add('visible');
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
        this.instructionsOverlay.classList.remove('visible');
        setTimeout(() => {
            this.instructionsContent.innerHTML = '';
            onDismiss();
        }, 500); // Match CSS transition duration
    }

    public updateScore(score: number) {
        this.scoreElement.innerText = `Score: ${score} `;
    }

    public updateThrottleVisuals(val: number) {
        this.gameThrottle.updateVisuals(val);
    }
}
