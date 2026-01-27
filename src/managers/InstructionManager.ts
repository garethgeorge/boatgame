import { InputManager } from './InputManager';
import { BiomeType } from '../world/biomes/BiomeType';
import { RiverSystem } from '../world/RiverSystem';

export class InstructionManager {
    private static readonly STORAGE_KEY_PREFIX = 'instruction_shown_';
    private static readonly CONTROL_INSTRUCTION_DELAY = 10; // Seconds of inactivity before showing
    private static readonly CONTROL_DETECTION_THRESHOLD = 0.5; // Threshold for steering/throttle to count as "knowing"

    private timeSinceLastAction: number = 0;
    private hasShownControls: boolean = false;
    private hasCompetence: boolean = false;

    private currentBiome: BiomeType | null = null;

    constructor() {
    }

    public update(dt: number, worldZ: number, speed: number, inputManager: InputManager, onTrigger: (url: string) => void) {
        this.updateControlDetection(dt, speed, inputManager, onTrigger);
        this.updateBiomeDetection(worldZ, onTrigger);
    }

    private updateControlDetection(dt: number, speed: number, inputManager: InputManager, onTrigger: (url: string) => void) {
        if (this.hasCompetence || this.hasShownControls) return;

        // Check for significant input
        const isSteering = Math.abs(inputManager.tilt) > InstructionManager.CONTROL_DETECTION_THRESHOLD ||
            inputManager.isDown('left') ||
            inputManager.isDown('right');

        const isThrottling = inputManager.isDown('forward') ||
            inputManager.isDown('backward');

        if (isSteering || (isThrottling && speed > 2.0)) {
            this.hasCompetence = true;
            return;
        }

        this.timeSinceLastAction += dt;

        if (this.timeSinceLastAction > InstructionManager.CONTROL_INSTRUCTION_DELAY) {
            this.hasShownControls = true;
            const url = inputManager.isMobile() ? 'assets/instructions/controls_mobile.html' : 'assets/instructions/controls_desktop.html';
            onTrigger(url);
        }
    }

    private updateBiomeDetection(worldZ: number, onTrigger: (url: string) => void) {
        const riverSystem = RiverSystem.getInstance();
        const biomeBoundaries = riverSystem.biomeManager.getBiomeBoundaries(worldZ);

        // Find which biome we are currently in
        // Since getBiomeBoundaries returns the boundaries of the biome at worldZ,
        // we need to find the ID of that biome.
        // BiomeManager doesn't expose getting the type directly easily without reaching into activeInstances.
        // Let's use getFeatureSegments which returns the features (and their id).
        const segments = riverSystem.biomeManager.getFeatureSegments(worldZ, worldZ + 1);
        if (segments.length > 0) {
            const biomeId = segments[0].features.id;

            if (biomeId !== this.currentBiome) {
                this.currentBiome = biomeId;
                this.checkBiomeInstruction(biomeId, onTrigger);
            }
        }
    }

    private checkBiomeInstruction(biomeId: BiomeType, onTrigger: (url: string) => void) {
        const storageKey = InstructionManager.STORAGE_KEY_PREFIX + biomeId;
        const hasBeenShown = localStorage.getItem(storageKey);

        if (!hasBeenShown) {
            // Check if we have an instruction file for this biome
            // For now, we only have 'desert'
            if (biomeId === 'desert') {
                localStorage.setItem(storageKey, 'true');
                onTrigger(`assets/instructions/${biomeId}.html`);
            }
        }
    }

    public reset() {
        this.timeSinceLastAction = 0;
        this.hasShownControls = false;
        this.hasCompetence = false;
        this.currentBiome = null;

        this.clearShownInstructions();
    }

    public clearShownInstructions() {
        console.log('[InstructionManager] Clearing all shown instructions from localStorage');
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith(InstructionManager.STORAGE_KEY_PREFIX)) {
                localStorage.removeItem(key);
            }
        }
    }
}
