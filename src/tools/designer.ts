import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ProceduralPlant } from '../world/factories/LSystemPlantGenerator';
import { LSystemPlantBuilder } from '../world/factories/LSystemPlantBuilder';
import { ARCHETYPES as TREE_ARCHETYPES, LSystemTreeKind } from '../world/factories/LSystemTreeArchetypes';
import { ARCHETYPES as FLOWER_ARCHETYPES, LSystemFlowerKind } from '../world/factories/LSystemFlowerArchetypes';
import { LeafShader } from '../shaders/LeafShader';

// Mock GraphicsUtils for the designer to avoid complexity of the tracker
// if it's too tied to the main game state. Actually, let's try to use the real one
// or a simplified version for the designer.
import { GraphicsUtils } from '../core/GraphicsUtils';

import { DesignerUtils, HistoryManager } from '../core/DesignerUtils';

class Designer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private plantContainer: THREE.Group;

    private typeSelect: HTMLSelectElement;
    private archetypeSelect: HTMLSelectElement;
    private configEditor: HTMLTextAreaElement;
    private undoBtn: HTMLButtonElement;
    private redoBtn: HTMLButtonElement;
    private generateBtn: HTMLButtonElement;
    private randomizeBtn: HTMLButtonElement;
    private triCountSpan: HTMLElement;
    private genTimeSpan: HTMLElement;
    private errorDisplay: HTMLElement;

    private currentType: 'tree' | 'flower' = 'tree';
    private history: HistoryManager;
    private isInternalChange = false;

    constructor() {
        this.initUI();
        this.initThree();
        this.initResizer();

        // Load saved state
        const savedType = localStorage.getItem('plantDesignerType');
        const savedArchetype = localStorage.getItem('plantDesignerArchetype');

        if (savedType === 'tree' || savedType === 'flower') {
            this.currentType = savedType;
            this.typeSelect.value = savedType;
            this.updateArchetypeList();
        }

        if (savedArchetype) {
            // Check if the archetype exists in the current list
            const options = Array.from(this.archetypeSelect.options).map(o => o.value);
            if (options.includes(savedArchetype)) {
                this.archetypeSelect.value = savedArchetype;
            }
        }

        // Initial state for history
        const key = this.archetypeSelect.value;
        const archetypes = this.currentType === 'tree' ? TREE_ARCHETYPES : FLOWER_ARCHETYPES;
        const config = archetypes[key];
        const initialText = DesignerUtils.safeStringify(config);
        this.configEditor.value = initialText;

        this.history = new HistoryManager(initialText, (state) => {
            this.isInternalChange = true;
            this.configEditor.value = state;
            this.generate();
            this.isInternalChange = false;
        });

        this.generate();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    private initResizer() {
        const resizer = document.getElementById('resizer')!;
        const sidebar = document.getElementById('sidebar')!;
        const viewport = document.getElementById('viewport')!;
        let isResizing = false;

        const onPointerMove = (e: PointerEvent) => {
            if (!isResizing) return;

            let newWidth = e.clientX;
            // Clamp between min (250) and max (window width - 100px gap)
            newWidth = Math.max(250, Math.min(newWidth, window.innerWidth - 100));

            sidebar.style.width = `${newWidth}px`;
            this.onWindowResize();
        };

        const onPointerUp = () => {
            if (isResizing) {
                isResizing = false;
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                document.body.style.cursor = 'default';
                viewport.style.pointerEvents = 'auto';
                document.body.style.userSelect = 'auto';
            }
        };

        resizer.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            viewport.style.pointerEvents = 'none';
            document.body.style.userSelect = 'none';

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });
    }

    private initUI() {
        this.typeSelect = document.getElementById('type-select') as HTMLSelectElement;
        this.archetypeSelect = document.getElementById('archetype-select') as HTMLSelectElement;
        this.configEditor = document.getElementById('config-editor') as HTMLTextAreaElement;
        this.undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
        this.redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
        this.generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
        this.randomizeBtn = document.getElementById('randomize-btn') as HTMLButtonElement;
        this.triCountSpan = document.getElementById('tri-count') as HTMLElement;
        this.genTimeSpan = document.getElementById('gen-time') as HTMLElement;
        this.errorDisplay = document.getElementById('error-display') as HTMLElement;

        this.undoBtn.addEventListener('click', () => this.history.undo());
        this.redoBtn.addEventListener('click', () => this.history.redo());

        this.typeSelect.addEventListener('change', () => {
            this.currentType = this.typeSelect.value as 'tree' | 'flower';
            localStorage.setItem('plantDesignerType', this.currentType);
            this.updateArchetypeList();
            this.loadArchetype();
            localStorage.setItem('plantDesignerArchetype', this.archetypeSelect.value);
        });

        this.archetypeSelect.addEventListener('change', () => {
            this.loadArchetype();
            localStorage.setItem('plantDesignerArchetype', this.archetypeSelect.value);
        });

        this.generateBtn.addEventListener('click', () => {
            this.generate();
            this.history.push(this.configEditor.value);
        });

        this.randomizeBtn.addEventListener('click', () => {
            this.generate();
        });

        this.updateArchetypeList();

        let debounceTimer: any;
        this.configEditor.addEventListener('input', () => {
            if (this.isInternalChange) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.history.push(this.configEditor.value);
            }, 500);
        });

        // Add kbd support
        this.configEditor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.configEditor.selectionStart;
                const end = this.configEditor.selectionEnd;
                this.configEditor.value = this.configEditor.value.substring(0, start) + "  " + this.configEditor.value.substring(end);
                this.configEditor.selectionStart = this.configEditor.selectionEnd = start + 2;
                this.history.push(this.configEditor.value);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.generate();
                this.history.push(this.configEditor.value);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.history.undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                this.history.redo();
            }
        });
    }

    private updateArchetypeList() {
        this.archetypeSelect.innerHTML = '';
        const archetypes = this.currentType === 'tree' ? TREE_ARCHETYPES : FLOWER_ARCHETYPES;
        Object.keys(archetypes).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
            this.archetypeSelect.appendChild(option);
        });
    }

    private loadArchetype() {
        const key = this.archetypeSelect.value;
        const archetypes = this.currentType === 'tree' ? TREE_ARCHETYPES : FLOWER_ARCHETYPES;
        const config = archetypes[key];

        // We use a custom stringify that preserves functions for display
        this.configEditor.value = DesignerUtils.safeStringify(config);
        this.generate();
        this.history.push(this.configEditor.value);
    }


    private parseConfig(text: string): any {
        try {
            const parsed = DesignerUtils.parseConfig(text, THREE);

            // Sanitize Vector3 objects
            ProceduralPlant.sanitizeConfig(parsed);

            return parsed;
        } catch (e: any) {
            throw new Error("Parse Error: " + e.message);
        }
    }



    private initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(10, 10, 10);
        this.camera.lookAt(0, 5, 0);

        const container = document.getElementById('canvas-container')!;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 5, 0);
        this.controls.update();

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // Ground grid
        const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.scene.add(grid);

        this.plantContainer = new THREE.Group();
        this.scene.add(this.plantContainer);
    }

    private generate() {
        this.errorDisplay.style.display = 'none';
        const startTime = performance.now();

        try {
            const config = this.parseConfig(this.configEditor.value);

            // Clear previous
            while (this.plantContainer.children.length > 0) {
                const child = this.plantContainer.children[0];
                this.plantContainer.remove(child);
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }

            const plantGen = new ProceduralPlant();
            plantGen.generate(config);

            let totalTris = 0;

            if (this.currentType === 'tree') {
                const result = LSystemPlantBuilder.build(
                    `LSystemTree_${this.archetypeSelect.value}`,
                    plantGen,
                    config.visuals.leafKind
                );

                const woodMat = new THREE.MeshToonMaterial({ color: config.visuals.woodColor || 0x4b3621 });
                const leafMat = new THREE.ShaderMaterial({
                    ...LeafShader,
                    uniforms: THREE.UniformsUtils.clone(LeafShader.uniforms),
                    vertexColors: true,
                    side: result.canCullSecondary ? THREE.FrontSide : THREE.DoubleSide,
                    lights: true,
                    fog: true
                });
                leafMat.uniforms.diffuse.value = new THREE.Color(config.visuals.leafColor || 0x228B22);

                const woodMesh = new THREE.Mesh(result.primaryGeo, woodMat);
                const leafMesh = new THREE.Mesh(result.secondaryGeo, leafMat);

                this.plantContainer.add(woodMesh);
                this.plantContainer.add(leafMesh);

                totalTris = this.getTriangleCount(result.primaryGeo) + this.getTriangleCount(result.secondaryGeo);
            } else {
                const result = LSystemPlantBuilder.build(
                    `LSystemFlower_${this.archetypeSelect.value}`,
                    plantGen,
                    { kind: 'rectangle' }
                );

                const stalkMat = new THREE.MeshToonMaterial({ color: config.visuals.stalkColor || 0x4CAF50 });
                const petalMat = new THREE.MeshToonMaterial({ color: config.visuals.petalColor || 0xffffff, side: THREE.DoubleSide });
                const centerMat = new THREE.MeshToonMaterial({ color: config.visuals.centerColor || 0xFFD700 });

                const stalkMesh = new THREE.Mesh(result.primaryGeo, stalkMat);
                const petalMesh = new THREE.Mesh(result.secondaryGeo, petalMat);
                const centerMesh = (result.tertiaryGeo) ? new THREE.Mesh(result.tertiaryGeo, centerMat) : null;

                this.plantContainer.add(stalkMesh);
                this.plantContainer.add(petalMesh);
                if (centerMesh) this.plantContainer.add(centerMesh);

                totalTris = this.getTriangleCount(result.primaryGeo) + this.getTriangleCount(result.secondaryGeo) + (result.tertiaryGeo ? this.getTriangleCount(result.tertiaryGeo) : 0);
            }

            this.triCountSpan.textContent = `Triangles: ${totalTris.toLocaleString()}`;
            this.genTimeSpan.textContent = `Time: ${Math.round(performance.now() - startTime)}ms`;

        } catch (e: any) {
            console.error(e);
            this.errorDisplay.textContent = e.message;
            this.errorDisplay.style.display = 'block';
        }
    }

    private getTriangleCount(geo: THREE.BufferGeometry): number {
        if (geo.index) return geo.index.count / 3;
        return geo.attributes.position ? geo.attributes.position.count / 3 : 0;
    }

    private onWindowResize() {
        const container = document.getElementById('canvas-container')!;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    private animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new Designer();
