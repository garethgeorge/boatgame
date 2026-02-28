import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { GameEngine } from '../GameEngine.js';
import { BiomeManager } from '../world/BiomeManager.js';
import { BiomeType } from '../world/biomes/BiomeType.js';
import { Decorations } from '../world/decorations/Decorations.js';
import { DesignerSettings } from '../core/DesignerSettings.js';
import { RiverSystem } from '../world/RiverSystem.js';
import { DebugSettings } from '../core/DebugSettings.js';
import { Profiler } from '../core/Profiler.js';
import { DebugConsole } from '../core/DebugConsole.js';
import { DesignerUtils, HistoryManager } from './DesignerUtils.js';


class BiomeDesigner {
    private engine: GameEngine;
    private controls!: MapControls;
    private isInternalChange = false;
    private teleportMode = false;
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private mouseDownPos = new THREE.Vector2();

    constructor() {
        const container = document.getElementById('canvas-container');
        if (!container) throw new Error('Canvas container not found');

        // Setup Biome Designer Mode
        const params = new URLSearchParams(window.location.search);
        const targetBiome = (params.get('biome') as BiomeType) || 'happy';

        DesignerSettings.isDesignerMode = true;
        DesignerSettings.targetBiome = targetBiome;

        this.engine = new GameEngine(container);

        this.initUI(targetBiome);
        this.initSimulationUI();
        this.initDebugMenu();
        this.initStatsDisplay();
    }

    private debugMenu!: HTMLElement;

    private initUI(currentBiome: BiomeType) {
        const biomeSelect = document.getElementById('biome-select') as HTMLSelectElement;
        const timeSlider = document.getElementById('time-slider') as HTMLInputElement;
        const reloadBtn = document.getElementById('reload-btn') as HTMLButtonElement;
        const resetCameraBtn = document.getElementById('reset-camera-btn') as HTMLButtonElement;

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

        resetCameraBtn.addEventListener('click', () => {
            this.resetCamera();
        });

        timeSlider.addEventListener('input', () => {
            const val = parseFloat(timeSlider.value);
            this.engine.skyManager.setCycleTime(val);
        });

        // Initial sky time
        this.engine.skyManager.isCyclePaused = true;
        this.engine.skyManager.setCycleTime(parseFloat(timeSlider.value));

    }

    private initSimulationUI() {
        const bottleCountInput = document.getElementById('bottle-count') as HTMLInputElement;
        const bottleCountDisplay = document.getElementById('bottle-count-display') as HTMLSpanElement;
        const teleportToggleBtn = document.getElementById('teleport-toggle-btn') as HTMLButtonElement;

        bottleCountInput.addEventListener('input', () => {
            const targetCount = parseInt(bottleCountInput.value);
            bottleCountDisplay.textContent = targetCount.toString();
            this.setBottleCount(targetCount);
        });

        const simSpeedInput = document.getElementById('sim-speed') as HTMLInputElement;
        const simSpeedDisplay = document.getElementById('sim-speed-display') as HTMLSpanElement;

        simSpeedInput.addEventListener('input', () => {
            const speed = parseFloat(simSpeedInput.value);
            simSpeedDisplay.textContent = speed.toFixed(1);
            this.engine.timeScale = speed;
        });

        teleportToggleBtn.addEventListener('click', () => {
            this.teleportMode = !this.teleportMode;
            teleportToggleBtn.textContent = `Teleport Mode: ${this.teleportMode ? 'ON' : 'OFF'}`;
            teleportToggleBtn.style.background = this.teleportMode ? '#4488ff' : '#444';
        });

        const canvas = this.engine.graphicsEngine.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => {
            this.mouseDownPos.set(e.clientX, e.clientY);
        });

        canvas.addEventListener('mouseup', (e) => {
            if (!this.teleportMode) return;

            // Check if it was a click (minimal movement)
            const dist = Math.sqrt(Math.pow(e.clientX - this.mouseDownPos.x, 2) + Math.pow(e.clientY - this.mouseDownPos.y, 2));
            if (dist > 5) return;

            const rect = canvas.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.engine.graphicsEngine.camera);

            // Intersect with terrain meshes
            const intersects = this.raycaster.intersectObjects(this.engine.graphicsEngine.scene.children, true);

            // Find the first intersection that is either water or ground
            const hit = intersects.find(i => {
                // Try to identify terrain/water meshes. 
                // Usually they are in the scene and have specific names or types.
                // For now, any mesh that isn't the boat will do as a target.
                return i.object.type === 'Mesh' && !this.isBoatPart(i.object);
            });

            if (hit) {
                this.engine.boat.teleport(hit.point.x, hit.point.z);
                // Optional: Toggle off after use
                // this.teleportMode = false;
                // teleportToggleBtn.textContent = 'Teleport Mode: OFF';
                // teleportToggleBtn.style.background = '#444';
            }
        });

        // Periodically update bottle count input to match boat state (in case it changes)
        setInterval(() => {
            if (this.engine.boat && document.activeElement !== bottleCountInput) {
                const count = this.engine.boat.collectedBottles.count;
                bottleCountInput.value = count.toString();
                bottleCountDisplay.textContent = count.toString();
            }
        }, 1000);
    }

    private isBoatPart(object: THREE.Object3D): boolean {
        let curr: THREE.Object3D | null = object;
        while (curr) {
            if (this.engine.boat.meshes.includes(curr as any)) return true;
            curr = curr.parent;
        }
        return false;
    }

    private setBottleCount(target: number) {
        const collected = this.engine.boat.collectedBottles;
        const current = collected.count;

        if (target > current) {
            for (let i = 0; i < target - current; i++) {
                collected.addBottle(0x0088FF, false); // Add without animation for instant control
            }
        } else if (target < current) {
            for (let i = 0; i < current - target; i++) {
                collected.removeBottle(false); // Remove without animation
            }
        }
    }


    private initDebugMenu() {
        this.debugMenu = document.getElementById('debug-menu') as HTMLElement;
        if (!this.debugMenu) return;

        const geometryToggle = document.getElementById('debug-geometry') as HTMLInputElement;
        const profilerToggle = document.getElementById('debug-profiler') as HTMLInputElement;
        const consoleToggle = document.getElementById('debug-console') as HTMLInputElement;
        const mobileSelect = document.getElementById('debug-mobile-mode') as HTMLSelectElement;

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

        mobileSelect.addEventListener('change', () => {
            const val = mobileSelect.value;
            if (val === 'auto') this.engine.inputManager.setMobileOverride(null);
            else if (val === 'mobile') this.engine.inputManager.setMobileOverride(true);
            else if (val === 'desktop') this.engine.inputManager.setMobileOverride(false);
        });

        const logMetadataBtn = document.getElementById('log-metadata-btn');
        if (logMetadataBtn) {
            // Handled in initMetadataUI
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyZ') {
                this.toggleDebugMenu();
            }
        });
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

    async init() {
        DebugConsole.init();
        // Preload essential assets
        await Promise.all([
            Decorations.preload(['boat']),
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

        // Restore camera position and target
        const savedPos = localStorage.getItem('biomeDesignerCameraPos');
        const savedTarget = localStorage.getItem('biomeDesignerCameraTarget');

        if (savedPos && savedTarget) {
            try {
                const pos = JSON.parse(savedPos);
                const target = JSON.parse(savedTarget);
                this.engine.graphicsEngine.camera.position.set(pos.x, pos.y, pos.z);
                this.controls.target.set(target.x, target.y, target.z);
            } catch (e) {
                console.error('[BiomeDesigner] Error restoring camera state:', e);
                this.controls.target.set(0, 2, 0);
                this.engine.graphicsEngine.camera.position.set(20, 20, 20);
            }
        } else {
            this.controls.target.set(0, 2, 0);
            // Initial camera position for better view
            this.engine.graphicsEngine.camera.position.set(20, 20, 20);
        }

        this.controls.update();

        // Save camera state on change
        let saveTimeout: any;
        this.controls.addEventListener('change', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const pos = this.engine.graphicsEngine.camera.position;
                const target = this.controls.target;
                localStorage.setItem('biomeDesignerCameraPos', JSON.stringify({ x: pos.x, y: pos.y, z: pos.z }));
                localStorage.setItem('biomeDesignerCameraTarget', JSON.stringify({ x: target.x, y: target.y, z: target.z }));
            }, 500);
        });

        const originalOnUpdate = this.engine.onUpdate;
        this.engine.onUpdate = (dt) => {
            this.controls.update();
            if (originalOnUpdate) originalOnUpdate(dt);
        };
    }

    private resetCamera() {
        this.controls.target.set(0, 2, 0);
        this.engine.graphicsEngine.camera.position.set(20, 20, 20);
        this.controls.update();

        // Clear saved state so it doesn't immediately overwrite on next change with old values
        // though the controls.update() might trigger a change event.
        localStorage.removeItem('biomeDesignerCameraPos');
        localStorage.removeItem('biomeDesignerCameraTarget');
    }



    private initStatsDisplay() {
        const header = document.getElementById('stats-header')!;
        const content = document.getElementById('stats-content')!;

        // Collapsible behavior
        header.addEventListener('click', () => {
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
            const isCollapsed = content.classList.contains('collapsed');
            localStorage.setItem('biomeDesignerStatsCollapsed', isCollapsed ? 'true' : 'false');
        });

        // Restore collapsed state
        const savedCollapsed = localStorage.getItem('biomeDesignerStatsCollapsed');
        if (savedCollapsed === 'true') {
            header.classList.add('collapsed');
            content.classList.add('collapsed');
        }

        // Start update loop
        setInterval(() => this.updateStats(), 2000);
    }

    private updateStats() {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;

        if (!this.engine.terrainManager || !this.engine.entityManager) return;

        const decorationStats = this.engine.terrainManager.getDecorationStats();
        const entityStats = this.engine.entityManager.getEntityStats();

        let html = '';

        const renderSection = (title: string, stats: Map<string, number>) => {
            if (stats.size === 0) return '';

            const sortedKeys = Array.from(stats.keys()).sort();
            let sectionHtml = `
                <div style="margin-top: 10px;">
                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; opacity: 0.5; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
                        ${title}
                    </div>
                    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            `;

            for (const key of sortedKeys) {
                const count = stats.get(key)!;
                sectionHtml += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 2px 0;">${key}</td>
                        <td style="padding: 2px 0; text-align: right;">${count}</td>
                    </tr>
                `;
            }

            sectionHtml += `
                    </table>
                </div>
            `;
            return sectionHtml;
        };

        const decoHtml = renderSection('Decorations', decorationStats);
        const entityHtml = renderSection('Entities', entityStats);

        if (!decoHtml && !entityHtml) {
            html = '<div style="text-align: center; opacity: 0.5; padding: 10px; font-size: 12px;">No data</div>';
        } else {
            html = decoHtml + entityHtml;
        }

        statsContent.innerHTML = html;
    }


}

window.addEventListener('DOMContentLoaded', async () => {
    const designer = new BiomeDesigner();
    await designer.init();
});
