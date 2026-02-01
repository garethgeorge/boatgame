import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DECORATION_MANIFEST, DecorationManifestEntry } from '../world/DecorationsManifest';
import { ENTITY_MANIFEST, BOAT_MANIFEST, EntityManifestEntry } from '../entities/EntitiesManifest';
import { DecorationMetadata } from '../world/DecorationMetadata';
import { EntityMetadata, BoatMetadata } from '../entities/EntityMetadata';
import { GraphicsUtils } from '../core/GraphicsUtils';
import { DesignerUtils } from './DesignerUtils';
import { Decorations } from '../world/Decorations';
import { MetadataExtractor } from './MetadataExtractorLogic';

class MetadataExtractorPage {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private currentModel: THREE.Object3D | null = null;
    private circleGroup: THREE.Group;

    // Animation state
    private mixer: THREE.AnimationMixer | null = null;
    private currentAction: THREE.AnimationAction | null = null;
    private clock = new THREE.Clock();

    // UI Elements
    private typeSelect: HTMLSelectElement;
    private itemSelect: HTMLSelectElement;
    private animationGroup: HTMLElement;
    private boatGroup: HTMLElement;
    private animationSelect: HTMLSelectElement;
    private dividerInput: HTMLInputElement;
    private speedSlider: HTMLInputElement;
    private speedDisplay: HTMLElement;

    private decoMetadataArea: HTMLTextAreaElement;
    private entityMetadataArea: HTMLTextAreaElement;
    private extractBtn: HTMLButtonElement;
    private updateHullBtn: HTMLButtonElement;
    private applyAllCheckbox: HTMLInputElement;

    private localDecoMetadata: any;
    private localEntityMetadata: any;
    private selectedType: 'decoration' | 'entity' = 'decoration';
    private selectedName: string | null = null;

    constructor() {
        this.initThree();
        this.initUI();
        this.loadInitialMetadata();
        this.populateItems();
        this.animate();

        // Register window resize
        window.addEventListener('resize', () => this.onWindowResize());

        this.init();
    }

    private async init() {
        try {
            await Decorations.preloadAll();
            console.log("Assets preloaded.");
        } catch (e) {
            console.error("Failed to preload assets:", e);
        }

        // Hide loading overlay
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => loading.remove(), 500);
        }
    }

    private initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        const viewport = document.getElementById('viewport')!;
        this.camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
        this.camera.position.set(10, 10, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        viewport.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // Grid
        const grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        this.scene.add(grid);

        this.circleGroup = new THREE.Group();
        this.scene.add(this.circleGroup);
    }

    private initUI() {
        this.typeSelect = document.getElementById('type-select') as HTMLSelectElement;
        this.itemSelect = document.getElementById('item-select') as HTMLSelectElement;

        this.animationGroup = document.getElementById('animation-group')!;
        this.boatGroup = document.getElementById('boat-group')!;
        this.animationSelect = document.getElementById('animation-select') as HTMLSelectElement;
        this.dividerInput = document.getElementById('divider-input') as HTMLInputElement;
        this.speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
        this.speedDisplay = document.getElementById('speed-display')!;

        this.decoMetadataArea = document.getElementById('decoration-metadata-js') as HTMLTextAreaElement;
        this.entityMetadataArea = document.getElementById('entity-metadata-js') as HTMLTextAreaElement;
        this.extractBtn = document.getElementById('extract-btn') as HTMLButtonElement;
        this.updateHullBtn = document.getElementById('update-hull-btn') as HTMLButtonElement;
        this.applyAllCheckbox = document.getElementById('apply-all-checkbox') as HTMLInputElement;

        this.applyAllCheckbox.addEventListener('change', () => {
            this.updateButtonLabels();
        });

        this.typeSelect.addEventListener('change', () => {
            this.selectedType = this.typeSelect.value as 'decoration' | 'entity';
            this.populateItems();
        });

        this.itemSelect.addEventListener('change', () => {
            this.selectItem(this.itemSelect.value);
        });

        this.animationSelect.addEventListener('change', () => {
            this.playAnimation(this.animationSelect.value);
        });

        this.speedSlider.addEventListener('input', () => {
            const speed = parseFloat(this.speedSlider.value);
            this.speedDisplay.textContent = speed.toFixed(1) + 'x';
            if (this.mixer) {
                this.mixer.timeScale = speed;
            }
        });

        this.dividerInput.addEventListener('input', () => {
            if (this.selectedName === 'boat') {
                this.updateHull();
            }
        });

        this.decoMetadataArea.addEventListener('input', () => this.syncMetadata());
        this.entityMetadataArea.addEventListener('input', () => this.syncMetadata());

        this.extractBtn.addEventListener('click', () => this.extractAll());
        this.updateHullBtn.addEventListener('click', () => this.updateHull());

        this.updateButtonLabels();
    }

    private updateButtonLabels() {
        const all = this.applyAllCheckbox.checked;
        this.updateHullBtn.textContent = all ? "Update Hulls (All Entities)" : "Update Hull (Current Entity)";
        this.extractBtn.textContent = all ? "Extract Fresh Metadata (All)" : "Extract Fresh Metadata (Current)";
    }

    private loadInitialMetadata() {
        this.localDecoMetadata = { ...DecorationMetadata };
        this.localEntityMetadata = { ...EntityMetadata, boat: BoatMetadata };

        this.updateMetadataAreas();
    }

    private updateMetadataAreas() {
        this.decoMetadataArea.value = "{\n" +
            Object.entries(this.localDecoMetadata)
                .map(([name, data]: [string, any]) => MetadataExtractor.formatDecoration(name, data))
                .join("\n") +
            "\n}";

        const entitiesStr = Object.entries(this.localEntityMetadata)
            .filter(([name]) => name !== 'boat')
            .map(([name, data]: [string, any]) => MetadataExtractor.formatEntity(name, data))
            .join("\n");

        const boatMeta = this.localEntityMetadata['boat'];
        let boatStr = "";
        if (boatMeta) {
            boatStr = `\n\n// BoatMetadata\n{\n` +
                `    radius: ${boatMeta.radius},\n` +
                `    width: ${boatMeta.width},\n` +
                `    length: ${boatMeta.length},\n` +
                `    bow_y: ${boatMeta.bow_y},\n` +
                `    stern_y: ${boatMeta.stern_y},\n` +
                `    frontHull: [ ${boatMeta.frontHull?.join(', ')} ],\n` +
                `    backHull: [ ${boatMeta.backHull?.join(', ')} ]\n` +
                `}`;
        }

        this.entityMetadataArea.value = "{\n" + entitiesStr + "\n}" + boatStr;
    }

    private populateItems() {
        this.itemSelect.innerHTML = '<option value="">Select Item...</option>';
        this.selectedName = null;
        this.cleanupModel();

        // Reset UI
        this.animationGroup.style.display = 'none';
        this.boatGroup.style.display = 'none';

        if (this.selectedType === 'decoration') {
            DECORATION_MANIFEST.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name;
                opt.textContent = d.name;
                this.itemSelect.appendChild(opt);
            });
        } else {
            const entities = [...ENTITY_MANIFEST, BOAT_MANIFEST];
            entities.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.name;
                opt.textContent = e.name;
                this.itemSelect.appendChild(opt);
            });
        }
    }

    private cleanupModel() {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            // Dispose logic could be added here if needed
            this.currentModel = null;
        }
        this.mixer = null;
        this.currentAction = null;
        this.updateCircles();
    }

    private async selectItem(name: string) {
        if (!name) {
            this.cleanupModel();
            return;
        }

        this.selectedName = name;
        this.cleanupModel();

        try {
            if (this.selectedType === 'decoration') {
                this.loadDecoration(name);
            } else {
                this.loadEntity(name);
                if (name === 'boat') {
                    this.boatGroup.style.display = 'block';
                    this.dividerInput.value = BOAT_MANIFEST.frontZoneEndY?.toString() || "0";
                }
            }

            this.updateCircles();
            this.centerCamera();

        } catch (e) {
            console.error(`Failed to load model for ${name}:`, e);
        }
    }

    private loadDecoration(name: string) {
        this.animationGroup.style.display = 'none';

        const entry = DECORATION_MANIFEST.find(d => d.name === name);
        if (entry) {
            const modelResult = entry.model();
            const results = Array.isArray(modelResult) ? modelResult : [modelResult];

            if (results.length > 0) {
                const group = new THREE.Group();
                results.forEach(res => {
                    if (res instanceof THREE.Object3D) {
                        group.add(GraphicsUtils.cloneObject(res));
                    } else if (res && 'geometry' in res && 'material' in res) {
                        const mesh = new THREE.Mesh(res.geometry, res.material);
                        if (res.matrix) {
                            mesh.matrixAutoUpdate = false;
                            mesh.matrix.copy(res.matrix);
                        }
                        group.add(mesh);
                    }
                });
                this.currentModel = group;
                this.scene.add(this.currentModel);
            }
        }
    }

    private loadEntity(name: string) {
        const entry = [...ENTITY_MANIFEST, BOAT_MANIFEST].find(e => e.name === name);
        if (entry) {
            try {
                const modelResult = entry.model();
                if (!modelResult) return;
                const { model, animations } = modelResult;
                this.currentModel = SkeletonUtils.clone(model);
                GraphicsUtils.registerObject(this.currentModel);

                const params = entry.params;
                this.currentModel.scale.setScalar(params.scale);
                if (params.angle !== undefined) {
                    this.currentModel.rotation.y = params.angle;
                }
                this.currentModel.updateMatrixWorld(true);
                this.scene.add(this.currentModel);

                // Setup animations
                this.animationSelect.innerHTML = '<option value="">None</option>';
                if (animations && animations.length > 0) {
                    this.animationGroup.style.display = 'block';
                    this.mixer = new THREE.AnimationMixer(this.currentModel);

                    animations.forEach(clip => {
                        const opt = document.createElement('option');
                        opt.value = clip.name;
                        opt.textContent = clip.name;
                        this.animationSelect.appendChild(opt);
                    });

                    // Store animations for lookup
                    (this.currentModel as any)._animations = animations;
                } else {
                    this.animationGroup.style.display = 'none';
                }

            } catch (e) {
                console.warn(e);
            }
        }
    }

    private playAnimation(name: string) {
        if (!this.mixer || !this.currentModel) return;

        if (this.currentAction) {
            this.currentAction.stop();
            this.currentAction = null;
        }

        if (name) {
            const animations = (this.currentModel as any)._animations || [];
            const clipObj = animations.find((a: any) => a.name === name);

            if (clipObj) {
                this.currentAction = this.mixer.clipAction(clipObj);
                this.currentAction!.play();
                this.currentAction!.setEffectiveTimeScale(parseFloat(this.speedSlider.value));
            }
        }
    }

    private centerCamera() {
        if (this.currentModel) {
            const box = new THREE.Box3().setFromObject(this.currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            this.controls.target.copy(center);
            this.camera.position.set(center.x + maxDim * 2, center.y + maxDim, center.z + maxDim * 2);
        }
    }

    private syncMetadata() {
        try {
            this.localDecoMetadata = DesignerUtils.parseConfig(this.decoMetadataArea.value, THREE);
            this.localEntityMetadata = DesignerUtils.parseConfig(this.entityMetadataArea.value, THREE);
            this.updateCircles();
        } catch (e) {
        }
    }

    private updateCircles() {
        while (this.circleGroup.children.length > 0) {
            const child = this.circleGroup.children[0];
            this.circleGroup.remove(child);
            if (child instanceof THREE.Line) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        }

        if (!this.selectedName) return;

        console.log(`Updating circles for ${this.selectedName}...`);
        const name = this.selectedName;
        if (this.selectedType === 'decoration') {
            const meta = this.localDecoMetadata[name];
            if (meta) {
                if (meta.groundRadius > 0) {
                    this.addCircle(meta.groundRadius, 0x00ff00, 0.05);
                }
                if (meta.canopyRadius > 0) {
                    this.addCircle(meta.canopyRadius, 0xffff00, 0.1);
                }
            }
        } else {
            const meta = this.localEntityMetadata[name];
            if (meta) {
                if (meta.radius > 0) {
                    this.addCircle(meta.radius, 0xff0000, 0.05);
                }
                if (name === 'boat') {
                    if (meta.frontHull) this.addHull(meta.frontHull, 0xff00ff, 0.1);
                    if (meta.backHull) this.addHull(meta.backHull, 0xff00ff, 0.1);
                } else if (meta.hull) {
                    this.addHull(meta.hull, 0xff00ff, 0.1);
                }
            }
        }
    }

    private addHull(hull: number[], color: number, y: number) {
        if (!hull || hull.length < 6) return; // Need at least 3 points (6 numbers)

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let i = 0; i < hull.length; i += 2) {
            vertices.push(hull[i], y, hull[i + 1]);
        }
        // Close the loop
        vertices.push(hull[0], y, hull[1]);

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
        const line = new THREE.Line(geometry, material);
        this.circleGroup.add(line);
    }

    private addCircle(radius: number, color: number, y: number) {
        const segments = 64;
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            vertices.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
        const line = new THREE.LineLoop(geometry, material);
        this.circleGroup.add(line);
    }

    private async updateHull() {
        const all = this.applyAllCheckbox.checked;

        if (!all) {
            if (this.selectedType !== 'entity' || !this.selectedName || !this.currentModel) {
                alert("Please select an entity first.");
                return;
            }

            if (this.selectedName === 'boat') {
                const divider = parseFloat(this.dividerInput.value) || 0;
                const hulls = MetadataExtractor.computeBoatHulls(this.currentModel, divider);
                Object.assign(this.localEntityMetadata['boat'], hulls);
            } else {
                const hull = MetadataExtractor.computeHull(this.currentModel, 8);
                if (hull.length > 0) {
                    this.localEntityMetadata[this.selectedName].hull = hull;
                }
            }
            this.updateMetadataAreas();
            this.updateCircles();
            console.log(`Hull updated for ${this.selectedName}`);
        } else {
            this.updateHullBtn.disabled = true;
            this.updateHullBtn.textContent = 'Updating...';

            try {
                const entities = [...ENTITY_MANIFEST, BOAT_MANIFEST];
                for (const entry of entities) {
                    console.log(`Computing hull for ${entry.name}...`);
                    try {
                        const modelResult = entry.model();
                        if (!modelResult) continue;
                        const { model } = modelResult;
                        const clone = SkeletonUtils.clone(model);
                        const params = entry.params;
                        clone.scale.setScalar(params.scale);
                        if (params.angle !== undefined) {
                            clone.rotation.y = params.angle;
                        }
                        clone.updateMatrixWorld(true);

                        if (entry.name === 'boat') {
                            const hulls = MetadataExtractor.computeBoatHulls(clone, entry.frontZoneEndY || -1.0);
                            this.localEntityMetadata['boat'] = { ...this.localEntityMetadata['boat'], ...hulls };
                        } else {
                            const hull = MetadataExtractor.computeHull(clone, 8);
                            if (hull.length > 0) {
                                this.localEntityMetadata[entry.name] = this.localEntityMetadata[entry.name] || {};
                                this.localEntityMetadata[entry.name].hull = hull;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to update hull for ${entry.name}:`, e);
                    }
                }
                this.updateMetadataAreas();
                this.updateCircles();
            } finally {
                this.updateHullBtn.disabled = false;
                this.updateButtonLabels();
            }
        }
    }

    private async extractAll() {
        this.extractBtn.disabled = true;
        this.extractBtn.textContent = 'Extracting...';

        const all = this.applyAllCheckbox.checked;
        const filter = all ? undefined : (this.selectedName ? { name: this.selectedName, type: this.selectedType } : undefined);

        if (!all && !filter) {
            alert("Please select an item first or check 'Apply to All'.");
            this.extractBtn.disabled = false;
            this.updateButtonLabels();
            return;
        }

        try {
            const results = await MetadataExtractor.generateMetadata(filter);

            // Merge results
            if (all) {
                this.localDecoMetadata = results.decorationResults;
                this.localEntityMetadata = results.entityResults;
            } else {
                Object.assign(this.localDecoMetadata, results.decorationResults);
                Object.assign(this.localEntityMetadata, results.entityResults);
            }

            this.updateMetadataAreas();
            this.updateCircles();
            console.log("Extraction complete.");

        } catch (e) {
            console.error("Extraction failed:", e);
        } finally {
            this.extractBtn.disabled = false;
            this.updateButtonLabels();
        }
    }

    private onWindowResize() {
        const viewport = document.getElementById('viewport')!;
        this.camera.aspect = viewport.clientWidth / viewport.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }

    private animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        if (this.mixer) {
            this.mixer.update(delta);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new MetadataExtractorPage();
