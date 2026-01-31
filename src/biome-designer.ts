import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { GameEngine } from './GameEngine.js';
import { BiomeManager } from './world/BiomeManager.js';
import { BiomeType } from './world/biomes/BiomeType.js';
import { Decorations } from './world/Decorations.js';
import { DesignerSettings } from './core/DesignerSettings.js';
import { BaseMangrove } from './entities/obstacles/Mangrove.js';
import { RiverSystem } from './world/RiverSystem.js';
import { DebugSettings } from './core/DebugSettings.js';
import { Profiler } from './core/Profiler.js';
import { DebugConsole } from './core/DebugConsole.js';
import { DesignerUtils, HistoryManager } from './core/DesignerUtils.js';
import { TierRule, Combine, Signal } from './world/decorators/PoissonDecorationRules.js';
import { SpeciesRules } from './world/biomes/decorations/SpeciesDecorationRules.js';

class BiomeDesigner {
    private engine: GameEngine;
    private controls!: MapControls;
    private rulesHistory!: HistoryManager;
    private isInternalChange = false;

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
        this.initDebugMenu();
        this.initRulesEditor();
        this.initStatsDisplay();
    }

    private debugMenu!: HTMLElement;

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
            const rulesTextarea = document.getElementById('rules-textarea') as HTMLTextAreaElement;
            const rulesContainer = document.getElementById('rules-editor-container');

            if (rulesContainer && rulesContainer.style.display !== 'none' && rulesTextarea) {
                this.applyRules(rulesTextarea.value);
            } else {
                RiverSystem.getInstance().biomeManager.resetDesignerBiome();
                this.engine.terrainManager.regenerateDesignerTerrain();
            }
        });

        timeSlider.addEventListener('input', () => {
            const val = parseFloat(timeSlider.value);
            this.engine.skyManager.setCycleTime(val);
        });

        // Initial sky time
        this.engine.skyManager.isCyclePaused = true;
        this.engine.skyManager.setCycleTime(parseFloat(timeSlider.value));

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

    private initRulesEditor() {
        const container = document.getElementById('rules-editor-container')!;
        const header = document.getElementById('rules-header')!;
        const content = document.getElementById('rules-editor-content')!;
        const textarea = document.getElementById('rules-textarea') as HTMLTextAreaElement;
        const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
        const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;

        // Collapsible behavior
        header.addEventListener('click', () => {
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
            const isCollapsed = content.classList.contains('collapsed');
            localStorage.setItem('biomeDesignerRulesCollapsed', isCollapsed ? 'true' : 'false');
        });

        // Restore collapsed state
        const savedCollapsed = localStorage.getItem('biomeDesignerRulesCollapsed');
        if (savedCollapsed === 'true') {
            header.classList.add('collapsed');
            content.classList.add('collapsed');
        }

        const updateEditorVisibility = () => {
            const features = RiverSystem.getInstance().biomeManager.getDesignerBiome();
            const rules = (features && features.getDecorationConfig) ? features.getDecorationConfig().rules : undefined;

            if (rules) {
                container.style.display = 'flex';
                const rulesText = DesignerUtils.safeStringify(rules);
                textarea.value = rulesText;
                this.rulesHistory = new HistoryManager(rulesText, (state) => {
                    this.isInternalChange = true;
                    textarea.value = state;
                    this.isInternalChange = false;
                });
            } else {
                container.style.display = 'none';
            }
        };

        // Initial check
        updateEditorVisibility();

        // Listen for biome changes (we can poll or hook into the biome select)
        const biomeSelect = document.getElementById('biome-select') as HTMLSelectElement;
        biomeSelect.addEventListener('change', () => {
            // Note: the page reloads on change currently, but if that changes:
            setTimeout(updateEditorVisibility, 100);
        });

        undoBtn.addEventListener('click', () => this.rulesHistory.undo());
        redoBtn.addEventListener('click', () => this.rulesHistory.redo());

        // Keyboard shortcuts
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + "  " + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 2;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.rulesHistory.push(textarea.value);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.rulesHistory.undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                this.rulesHistory.redo();
            }
        });

        let debounceTimer: any;
        textarea.addEventListener('input', () => {
            if (this.isInternalChange) return;

            const errorDisplay = document.getElementById('error-display');
            if (errorDisplay) errorDisplay.style.display = 'none';

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.rulesHistory.push(textarea.value);
            }, 500);
        });
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

    private applyRules(text: string) {
        const errorDisplay = document.getElementById('error-display')!;
        errorDisplay.style.display = 'none';

        try {
            const context = {
                THREE,
                TierRule,
                Combine,
                Signal,
                SpeciesRules
            };

            // Re-evaluate with full context
            const evalRules = new Function('THREE', 'TierRule', 'Combine', 'Signal', 'SpeciesRules', 'return ' + text)(
                context.THREE, context.TierRule, context.Combine, context.Signal, context.SpeciesRules
            );

            const features = RiverSystem.getInstance().biomeManager.getDesignerBiome();
            if (features && features.getDecorationConfig) {
                features.getDecorationConfig().rules = evalRules;
                RiverSystem.getInstance().biomeManager.setOverriddenRules(features.id, evalRules);

                RiverSystem.getInstance().biomeManager.resetDesignerBiome();
                this.engine.terrainManager.regenerateDesignerTerrain();
            }
        } catch (e: any) {
            console.error('[BiomeDesigner] applyRules error:', e);
            errorDisplay.textContent = `Error: ${e.message}`;
            errorDisplay.style.display = 'block';
        }
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const designer = new BiomeDesigner();
    await designer.init();
});
