import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DECORATION_MANIFEST, DecorationManifestEntry } from './world/DecorationsManifest';
import { ENTITY_MANIFEST, EntityManifestEntry } from './entities/EntitiesManifest';
import { DecorationMetadata } from './world/DecorationMetadata';
import { EntityMetadata } from './entities/EntityMetadata';
import { GraphicsUtils } from './core/GraphicsUtils';
import { DesignerUtils } from './core/DesignerUtils';
import { Decorations } from './world/Decorations';
import { MetadataExtractor } from './MetadataExtractorLogic';

class MetadataExtractorPage {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private currentModel: THREE.Object3D | null = null;
    private circleGroup: THREE.Group;

    private decorationList: HTMLElement;
    private entityList: HTMLElement;
    private decorationSearch: HTMLInputElement;
    private entitySearch: HTMLInputElement;
    private decoMetadataArea: HTMLTextAreaElement;
    private entityMetadataArea: HTMLTextAreaElement;
    private extractBtn: HTMLButtonElement;

    private localDecoMetadata: any;
    private localEntityMetadata: any;
    private selectedItem: { type: 'decoration' | 'entity', name: string } | null = null;

    constructor() {
        this.initThree();
        this.initUI();
        this.loadInitialMetadata();
        this.renderLists();
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
        this.decorationList = document.getElementById('decoration-list')!;
        this.entityList = document.getElementById('entity-list')!;
        this.decorationSearch = document.getElementById('decoration-search') as HTMLInputElement;
        this.entitySearch = document.getElementById('entity-search') as HTMLInputElement;
        this.decoMetadataArea = document.getElementById('decoration-metadata-js') as HTMLTextAreaElement;
        this.entityMetadataArea = document.getElementById('entity-metadata-js') as HTMLTextAreaElement;
        this.extractBtn = document.getElementById('extract-btn') as HTMLButtonElement;

        this.decorationSearch.addEventListener('input', () => this.renderLists());
        this.entitySearch.addEventListener('input', () => this.renderLists());

        this.decoMetadataArea.addEventListener('input', () => this.syncMetadata());
        this.entityMetadataArea.addEventListener('input', () => this.syncMetadata());

        this.extractBtn.addEventListener('click', () => this.extractAll());
    }

    private loadInitialMetadata() {
        this.localDecoMetadata = { ...DecorationMetadata };
        this.localEntityMetadata = { ...EntityMetadata };

        this.decoMetadataArea.value = DesignerUtils.safeStringify(this.localDecoMetadata);
        this.entityMetadataArea.value = DesignerUtils.safeStringify(this.localEntityMetadata);
    }

    private renderLists() {
        const decoTerm = this.decorationSearch.value.toLowerCase();
        const entityTerm = this.entitySearch.value.toLowerCase();

        this.decorationList.innerHTML = '';
        DECORATION_MANIFEST.filter(d => d.name.toLowerCase().includes(decoTerm)).forEach(d => {
            const item = document.createElement('div');
            item.className = 'list-item';
            if (this.selectedItem?.type === 'decoration' && this.selectedItem.name === d.name) {
                item.classList.add('selected');
            }
            item.textContent = d.name;
            item.onclick = () => this.selectItem('decoration', d.name);
            this.decorationList.appendChild(item);
        });

        this.entityList.innerHTML = '';
        ENTITY_MANIFEST.filter(e => e.name.toLowerCase().includes(entityTerm)).forEach(e => {
            const item = document.createElement('div');
            item.className = 'list-item';
            if (this.selectedItem?.type === 'entity' && this.selectedItem.name === e.name) {
                item.classList.add('selected');
            }
            item.textContent = e.name;
            item.onclick = () => this.selectItem('entity', e.name);
            this.entityList.appendChild(item);
        });
    }

    private async selectItem(type: 'decoration' | 'entity', name: string) {
        this.selectedItem = { type, name };
        this.renderLists();

        // Clear previous model
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }

        try {
            if (type === 'decoration') {
                const entry = DECORATION_MANIFEST.find(d => d.name === name);
                if (entry) {
                    const modelResult = entry.model();
                    // Some models return arrays of instances (e.g. trees with branches and leaves)
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
            } else {
                const entry = ENTITY_MANIFEST.find(e => e.name === name);
                if (entry) {
                    const model = entry.model();
                    // Entities are often skinned, use SkeletonUtils for safer cloning
                    this.currentModel = SkeletonUtils.clone(model);
                    GraphicsUtils.registerObject(this.currentModel);

                    console.log(`Scaling entity ${name} by ${entry.scale}`);
                    this.currentModel.scale.setScalar(entry.scale);
                    this.currentModel.updateMatrixWorld(true);
                    this.scene.add(this.currentModel);

                    const box = new THREE.Box3().setFromObject(this.currentModel);
                    console.log(`Scaled Bounding Box:`, box.min, box.max);
                    const size = box.getSize(new THREE.Vector3());
                    console.log(`Scaled Size:`, size);
                }
            }

            this.updateCircles();

            if (this.currentModel) {
                const box = new THREE.Box3().setFromObject(this.currentModel);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                this.controls.target.copy(center);
                this.camera.position.set(center.x + maxDim * 2, center.y + maxDim, center.z + maxDim * 2);
            }

        } catch (e) {
            console.error(`Failed to load model for ${name}:`, e);
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
        // ... (clear previous circles logic remains)
        while (this.circleGroup.children.length > 0) {
            const child = this.circleGroup.children[0];
            this.circleGroup.remove(child);
            if (child instanceof THREE.Line) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        }

        if (!this.selectedItem) return;

        console.log(`Updating circles for ${this.selectedItem.name}...`);
        const name = this.selectedItem.name;
        if (this.selectedItem.type === 'decoration') {
            const meta = this.localDecoMetadata[name];
            if (meta) {
                console.log(`  Deco Radii: Ground=${meta.groundRadius}, Canopy=${meta.canopyRadius}`);
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
                console.log(`  Entity Radius: ${meta.radius}`);
                if (meta.radius > 0) {
                    this.addCircle(meta.radius, 0xff0000, 0.05);
                }
            }
        }
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

    private async extractAll() {
        this.extractBtn.disabled = true;
        this.extractBtn.textContent = 'Extracting...';

        try {
            const results = await MetadataExtractor.generateMetadata();

            this.localDecoMetadata = results.decorationResults;
            this.localEntityMetadata = results.entityResults;

            this.decoMetadataArea.value = DesignerUtils.safeStringify(this.localDecoMetadata);
            this.entityMetadataArea.value = DesignerUtils.safeStringify(this.localEntityMetadata);

            this.updateCircles();
            console.log("Extraction complete.");

        } catch (e) {
            console.error("Extraction failed:", e);
        } finally {
            this.extractBtn.disabled = false;
            this.extractBtn.textContent = 'Extract Fresh Metadata';
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
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new MetadataExtractorPage();
