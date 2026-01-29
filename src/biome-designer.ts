import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { GameEngine } from './GameEngine.js';
import { BiomeManager } from './world/BiomeManager.js';
import { BiomeType } from './world/biomes/BiomeType.js';
import { Decorations } from './world/Decorations.js';
import { DesignerSettings } from './core/DesignerSettings.js';
import { BaseMangrove } from './entities/obstacles/Mangrove.js';
import { RiverSystem } from './world/RiverSystem.js';

class BiomeDesigner {
    private engine: GameEngine;
    private controls!: MapControls;

    constructor() {
        const container = document.getElementById('canvas-container');
        if (!container) throw new Error('Canvas container not found');

        this.engine = new GameEngine(container);

        // Setup Biome Designer Mode
        const params = new URLSearchParams(window.location.search);
        const targetBiome = (params.get('biome') as BiomeType) || 'happy';

        DesignerSettings.isDesignerMode = true;
        DesignerSettings.targetBiome = targetBiome;

        this.initUI(targetBiome);
    }

    private initUI(currentBiome: BiomeType) {
        const biomeSelect = document.getElementById('biome-select') as HTMLSelectElement;
        const timeSlider = document.getElementById('time-slider') as HTMLInputElement;
        const reloadBtn = document.getElementById('reload-btn') as HTMLButtonElement;

        biomeSelect.value = currentBiome;
        biomeSelect.addEventListener('change', () => {
            const newBiome = biomeSelect.value;
            const url = new URL(window.location.href);
            url.searchParams.set('biome', newBiome);
            window.location.href = url.toString();
        });

        reloadBtn.addEventListener('click', () => {
            RiverSystem.getInstance().biomeManager.resetDesignerBiome();
            this.engine.terrainManager.regenerateDesignerTerrain();
        });

        timeSlider.addEventListener('input', () => {
            const val = parseFloat(timeSlider.value);
            this.engine.skyManager.setCycleTime(val);
        });

        // Initial sky time
        this.engine.skyManager.isCyclePaused = true;
        this.engine.skyManager.setCycleTime(parseFloat(timeSlider.value));
    }

    async init() {
        // Preload essential assets
        await Promise.all([
            Decorations.preload(['boat']),
            BaseMangrove.preload(),
        ]);

        this.engine.init(() => {
            console.log('[BiomeDesigner] Engine ready');
            this.setupControls();

            // In designer mode, we might want to be unpaused by default
            this.engine.isPaused = false;

            this.engine.animate();
        });
    }

    private setupControls() {
        this.controls = new MapControls(this.engine.graphicsEngine.camera, this.engine.graphicsEngine.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 2, 0);

        // Initial camera position for better view
        this.engine.graphicsEngine.camera.position.set(20, 20, 20);
        this.controls.update();

        const originalOnUpdate = this.engine.onUpdate;
        this.engine.onUpdate = (dt) => {
            this.controls.update();
            if (originalOnUpdate) originalOnUpdate(dt);
        };
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const designer = new BiomeDesigner();
    await designer.init();
});
