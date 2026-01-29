import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ProceduralPlant } from './world/factories/LSystemPlantGenerator';
import { LSystemTreeBuilder } from './world/factories/LSystemTreeBuilder';
import { LSystemFlowerBuilder } from './world/factories/LSystemFlowerBuilder';
import { ARCHETYPES as TREE_ARCHETYPES, LSystemTreeKind } from './world/factories/LSystemTreeArchetypes';
import { ARCHETYPES as FLOWER_ARCHETYPES, LSystemFlowerKind } from './world/factories/LSystemFlowerArchetypes';

// Mock GraphicsUtils for the designer to avoid complexity of the tracker
// if it's too tied to the main game state. Actually, let's try to use the real one
// or a simplified version for the designer.
import { GraphicsUtils } from './core/GraphicsUtils';

class HistoryManager {
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private maxHistory = 50;
    private onStateChange: (state: string) => void;

    constructor(initialState: string, onStateChange: (state: string) => void) {
        this.undoStack.push(initialState);
        this.onStateChange = onStateChange;
    }

    public push(state: string) {
        if (state === this.undoStack[this.undoStack.length - 1]) return;
        this.undoStack.push(state);
        this.redoStack = [];
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.updateButtons();
    }

    public undo() {
        if (this.undoStack.length <= 1) return;
        const current = this.undoStack.pop()!;
        this.redoStack.push(current);
        const previous = this.undoStack[this.undoStack.length - 1];
        this.onStateChange(previous);
        this.updateButtons();
    }

    public redo() {
        if (this.redoStack.length === 0) return;
        const next = this.redoStack.pop()!;
        this.undoStack.push(next);
        this.onStateChange(next);
        this.updateButtons();
    }

    private updateButtons() {
        (document.getElementById('undo-btn') as HTMLButtonElement).disabled = this.undoStack.length <= 1;
        (document.getElementById('redo-btn') as HTMLButtonElement).disabled = this.redoStack.length === 0;
    }
}

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

        // Initial state for history
        const key = this.archetypeSelect.value;
        const archetypes = this.currentType === 'tree' ? TREE_ARCHETYPES : FLOWER_ARCHETYPES;
        const initialConfig = archetypes[key];
        const initialText = this.safeStringify(initialConfig);
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
            this.updateArchetypeList();
            this.loadArchetype();
        });

        this.archetypeSelect.addEventListener('change', () => {
            this.loadArchetype();
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
        this.configEditor.value = this.safeStringify(config);
        this.generate();
        this.history.push(this.configEditor.value);
    }

    private safeStringify(obj: any, indent = 0): string {
        const spacing = "  ".repeat(indent);
        const nextSpacing = "  ".repeat(indent + 1);

        if (obj === null) return "null";
        if (obj === undefined) return "undefined";
        if (typeof obj === "boolean") return obj.toString();
        if (typeof obj === "string") return `"${obj}"`;
        if (typeof obj === "function") return obj.toString();

        if (typeof obj === "number") {
            // Hex color formatting for values > 255 (heuristically colors)
            if (obj > 0xff) {
                return `0x${obj.toString(16).padStart(6, '0')}`;
            }
            return obj.toString();
        }

        if (obj instanceof THREE.Vector3) {
            return `new THREE.Vector3(${obj.x}, ${obj.y}, ${obj.z})`;
        }

        if (Array.isArray(obj)) {
            if (obj.length === 0) return "[]";
            const items = obj.map(item => this.safeStringify(item, indent + 1));
            return `[\n${nextSpacing}${items.join(`,\n${nextSpacing}`)}\n${spacing}]`;
        }

        if (typeof obj === "object") {
            // Check for Vector3-like objects
            if (obj.x !== undefined && obj.y !== undefined && obj.z !== undefined && Object.keys(obj).length === 3) {
                return `new THREE.Vector3(${obj.x}, ${obj.y}, ${obj.z})`;
            }

            const keys = Object.keys(obj);
            if (keys.length === 0) return "{}";

            const lines = keys.map(key => {
                const value = obj[key];
                const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
                let formattedValue = this.safeStringify(value, indent + 1);

                // Ensure colors in visuals are hex formatted even if small
                if (typeof value === "number" && key.toLowerCase().includes("color")) {
                    formattedValue = `0x${value.toString(16).padStart(6, '0')}`;
                }

                return `${formattedKey}: ${formattedValue}`;
            });

            return `{\n${nextSpacing}${lines.join(`,\n${nextSpacing}`)}\n${spacing}}`;
        }

        return String(obj);
    }

    private parseConfig(text: string): any {
        try {
            // provide THREE to the evaluation context
            const parsed = new Function('THREE', 'return ' + text)(THREE);

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
                const result = LSystemTreeBuilder.createArchetype(this.archetypeSelect.value as LSystemTreeKind, Math.random(), plantGen, config);

                const woodMat = new THREE.MeshToonMaterial({ color: config.visuals.woodColor || 0x4b3621 });
                const leafMat = new THREE.MeshToonMaterial({ color: config.visuals.leafColor || 0x228B22, side: result.canCullLeaves ? THREE.FrontSide : THREE.DoubleSide });

                const woodMesh = new THREE.Mesh(result.woodGeo, woodMat);
                const leafMesh = new THREE.Mesh(result.leafGeo, leafMat);

                this.plantContainer.add(woodMesh);
                this.plantContainer.add(leafMesh);

                totalTris = this.getTriangleCount(result.woodGeo) + this.getTriangleCount(result.leafGeo);
            } else {
                const result = LSystemFlowerBuilder.createArchetype(this.archetypeSelect.value as LSystemFlowerKind, Math.random(), plantGen, config);

                const stalkMat = new THREE.MeshToonMaterial({ color: config.visuals.stalkColor || 0x4CAF50 });
                const petalMat = new THREE.MeshToonMaterial({ color: config.visuals.petalColor || 0xffffff, side: THREE.DoubleSide });
                const centerMat = new THREE.MeshToonMaterial({ color: config.visuals.centerColor || 0xFFD700 });

                const stalkMesh = new THREE.Mesh(result.stalkGeo, stalkMat);
                const petalMesh = new THREE.Mesh(result.petalGeo, petalMat);
                const centerMesh = new THREE.Mesh(result.centerGeo, centerMat);

                this.plantContainer.add(stalkMesh);
                this.plantContainer.add(petalMesh);
                this.plantContainer.add(centerMesh);

                totalTris = this.getTriangleCount(result.stalkGeo) + this.getTriangleCount(result.petalGeo) + this.getTriangleCount(result.centerGeo);
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
