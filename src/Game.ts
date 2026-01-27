import { GameEngine } from './GameEngine';
import { GameUI } from './GameUI';
import { GraphicsUtils } from './core/GraphicsUtils';
import { Decorations } from './world/Decorations';
import { BaseMangrove } from './entities/obstacles/Mangrove';
import { DebugConsole } from './core/DebugConsole';
import { InstructionManager } from './managers/InstructionManager';
import { DebugSettings } from './core/DebugSettings';

export class Game {
    private engine: GameEngine;
    private ui: GameUI;
    private instructionManager: InstructionManager;

    constructor() {
        this.ui = new GameUI({
            onStart: () => this.start(),
            getBoatThrottle: () => this.engine.boat ? this.engine.boat.getThrottle() : 0,
            setBoatThrottle: (val: number) => { if (this.engine.boat) this.engine.boat.setThrottle(val); },
            isPaused: () => this.engine.isPaused,
            onResetInstructions: () => this.instructionManager.reset(),
            onSetMobileOverride: (val: boolean | null) => this.engine.inputManager.setMobileOverride(val)
        });

        this.instructionManager = new InstructionManager();
        this.engine = new GameEngine(this.ui.container);
        DebugConsole.init();

        // for now reset instruction manager on every launch
        this.instructionManager.reset();
    }

    async preload() {
        GraphicsUtils.tracker.verbose = false;
        await Promise.all([
            Decorations.preload(['boat']),
            BaseMangrove.preload(),
        ]);
        GraphicsUtils.tracker.verbose = false;
    }

    init() {
        this.engine.init(() => {
            this.ui.setStartButtonVisible(true);
        });

        // Link update loop to UI
        this.engine.onUpdate = (dt: number) => {
            this.updateUI();
            this.updateInstructions(dt);
        };

        this.engine.animate();
    }

    private updateUI() {
        if (this.engine.boat) {
            this.ui.updateScore(this.engine.boat.score);
            this.ui.updateThrottleVisuals(this.engine.boat.getThrottle());
        }
    }

    private updateInstructions(dt: number) {
        if (this.engine.isPaused || !this.engine.boat || this.engine.boat.meshes.length === 0) return;

        // Debug shortcuts
        if (this.engine.inputManager.wasPressed('toggleDebugMenu')) {
            this.ui.toggleDebugMenu();
        }

        const boatPos = this.engine.boat.meshes[0].position;
        const boatSpeed = this.engine.boat.physicsBodies[0].getLinearVelocity().length();

        this.instructionManager.update(
            dt,
            boatPos.z,
            boatSpeed,
            this.engine.inputManager,
            (url) => this.showPacedInstructions(url)
        );
    }

    async start() {
        console.log('[DEBUG] Game.start() called');
        await this.engine.inputManager.requestPermission();
        this.ui.hideStartScreen();
        this.engine.start();

        // Welcome instructions removed as requested
    }

    private easeTimeScale(target: number, duration: number): Promise<void> {
        return new Promise((resolve) => {
            const start = this.engine.timeScale;
            const startTime = performance.now();

            const step = (now: number) => {
                const elapsed = (now - startTime) / 1000;
                const t = Math.min(elapsed / duration, 1);
                this.engine.timeScale = start + (target - start) * t;

                if (t < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    private async showPacedInstructions(url: string) {
        // Slow down
        await this.easeTimeScale(0, 0.5);
        this.engine.setPaused(true);

        this.ui.showInstructions(url, async () => {
            this.engine.setPaused(false);
            // Re-accelerate
            await this.easeTimeScale(1, 1.0);
        });
    }
}
