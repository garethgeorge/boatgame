import { GameEngine } from './GameEngine';
import { GameUI } from './GameUI';
import { GraphicsUtils } from './core/GraphicsUtils';
import { Decorations } from './world/Decorations';
import { BaseMangrove } from './entities/obstacles/Mangrove';
import { DebugConsole } from './core/DebugConsole';

export class Game {
    private engine: GameEngine;
    private ui: GameUI;

    constructor() {
        this.ui = new GameUI({
            onStart: () => this.start(),
            getBoatThrottle: () => this.engine.boat ? this.engine.boat.getThrottle() : 0,
            setBoatThrottle: (val: number) => { if (this.engine.boat) this.engine.boat.setThrottle(val); },
            isPaused: () => this.engine.isPaused
        });

        this.engine = new GameEngine(this.ui.container);
        DebugConsole.init();
    }

    async preload() {
        GraphicsUtils.tracker.verbose = false;
        await Promise.all([
            Decorations.preload(),
            BaseMangrove.preload(),
        ]);
        GraphicsUtils.tracker.verbose = false;
    }

    init() {
        this.engine.init(() => {
            this.ui.setStartButtonVisible(true);
        });

        // Link update loop to UI
        this.engine.onUpdate = () => {
            this.updateUI();
        };

        this.engine.animate();
    }

    private updateUI() {
        if (this.engine.boat) {
            this.ui.updateScore(this.engine.boat.score);
            this.ui.updateThrottleVisuals(this.engine.boat.getThrottle());
        }
    }

    async start() {
        console.log('[DEBUG] Game.start() called');
        await this.engine.inputManager.requestPermission();
        this.ui.hideStartScreen();
        this.engine.start();

        console.log('[DEBUG] Showing welcome instructions');
        this.ui.showInstructions('assets/instructions/welcome.html', () => {
            this.engine.setPaused(false);
        });
        this.engine.setPaused(true);
    }
}
