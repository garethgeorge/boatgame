import * as THREE from 'three';
import { Profiler } from './Profiler';

type DisposableResource = THREE.Material | THREE.BufferGeometry | THREE.Texture;

export class GraphicsTracker {
    private trackedResources = new Map<DisposableResource, { refCount: number, lastMarked: number }>();
    private currentGeneration = 0;
    private isPaused = false;
    private visitedSet = new Set<DisposableResource>();

    // Common texture slots in Three.js materials for fast lookup
    private static readonly TEXTURE_PROPERTIES = [
        'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap', 'displacementMap',
        'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap', 'gradientMap',
        'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
        'sheenColorMap', 'sheenRoughnessMap', 'transmissionMap', 'thicknessMap',
        'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'iridescenceThicknessMap',
        'anisotropyMap'
    ];

    private visit(item: DisposableResource | THREE.Object3D,
        apply: (resource: DisposableResource) => void) {

        if (!item) return;

        const visited = new Set<DisposableResource>();
        const applyOnce = (res: DisposableResource) => {
            if (visited.has(res)) return;
            visited.add(res);
            apply(res);
        };

        if ((item as any).isObject3D) {
            (item as THREE.Object3D).traverse((child) => {
                this.visitObject(child, applyOnce);
            });
        } else if ((item as any).isMaterial) {
            this.visitMaterial(item as THREE.Material, applyOnce);
        } else {
            applyOnce(item as DisposableResource);
        }
    }

    private visitObject(obj: THREE.Object3D, apply: (resource: DisposableResource) => void) {
        const anyObj = obj as any;

        // Skip non-renderable objects using fast internal flags.
        const isRenderable = anyObj.isMesh || anyObj.isSprite || anyObj.isLine || anyObj.isPoints;

        if (isRenderable) {
            if (anyObj.geometry) apply(anyObj.geometry);

            const material = anyObj.material;
            if (material) {
                if (Array.isArray(material)) {
                    for (let i = 0, l = material.length; i < l; i++) {
                        this.visitMaterial(material[i], apply);
                    }
                } else {
                    this.visitMaterial(material, apply);
                }
            }
        }

        if (anyObj.isSkinnedMesh && anyObj.skeleton?.boneTexture) {
            apply(anyObj.skeleton.boneTexture);
        }
    }

    private visitMaterial(material: THREE.Material,
        apply: (resource: DisposableResource) => void) {

        apply(material);

        const anyMat = material as any;

        // Fast path for standard materials using predefined property keys
        const props = GraphicsTracker.TEXTURE_PROPERTIES;
        for (let i = 0, l = props.length; i < l; i++) {
            const tex = anyMat[props[i]];
            if (tex && tex.isTexture) {
                apply(tex);
            }
        }

        // Search uniforms for textures (fallback for ShaderMaterial or custom shaders)
        if (anyMat.isShaderMaterial || anyMat.uniforms) {
            const uniforms = anyMat.uniforms;
            if (uniforms) {
                for (const name in uniforms) {
                    const uniform = uniforms[name];
                    if (uniform && uniform.value) {
                        const val = uniform.value;
                        if (val.isTexture) {
                            apply(val);
                        } else if (Array.isArray(val)) {
                            for (let i = 0, l = val.length; i < l; i++) {
                                if (val[i]?.isTexture) apply(val[i]);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Register a resource or an Object3D's resources for tracking. If
     * verbose is true the registered resources are logged.
     */
    public register(item: DisposableResource | THREE.Object3D, verbose: boolean = false) {
        this.visit(item, (resource) => this.registerResource(resource, verbose));
    }

    private registerResource(resource: DisposableResource, verbose: boolean) {
        if (!this.trackedResources.has(resource)) {
            if (verbose)
                console.log('Register', resource.name, resource);
            this.trackedResources.set(resource, { refCount: 0, lastMarked: -1 });
        } else {
            if (verbose)
                console.log('Known', resource.name, resource);
        }
    }

    /**
     * Retain a resource (increment ref count). Used for caching.
     */
    public retain(item: DisposableResource | THREE.Object3D) {
        this.visit(item, (resource) => this.retainResource(resource));
    }

    private retainResource(resource: DisposableResource) {
        if (!resource) return;
        this.registerResource(resource, false);
        const info = this.trackedResources.get(resource);
        if (info) info.refCount++;
    }

    /**
     * Release a resource (decrement ref count).
     */
    public release(item: DisposableResource | THREE.Object3D) {
        this.visit(item, (resource) => this.releaseResource(resource));
    }

    private releaseResource(resource: DisposableResource) {
        const info = this.trackedResources.get(resource);
        if (info) info.refCount = Math.max(0, info.refCount - 1);
    }

    public pauseGC() { this.isPaused = true; }
    public resumeGC() { this.isPaused = false; }

    /**
     * Perform mark-and-sweep.
     */
    public update(scene: THREE.Scene) {
        const verbose = false;

        if (this.isPaused) {
            console.log('Collecting Skipped - Paused');
            return;
        }
        console.log('Collecting');

        Profiler.start('Collection');

        this.currentGeneration++;

        this.visitedSet.clear();
        const markOnce = (res: DisposableResource) => {
            if (this.visitedSet.has(res)) return;
            this.visitedSet.add(res);
            this.markResource(res);
        };

        // Mark Phase: Scene traversal
        scene.traverse((object) => {
            this.visitObject(object, markOnce);
        });

        // Sweep Phase
        for (const [resource, info] of this.trackedResources.entries()) {
            if (info.refCount <= 0 && info.lastMarked !== this.currentGeneration) {
                try {
                    if (verbose)
                        console.log('Dispose:', resource.name, resource);
                    resource.dispose();
                } catch (e) {
                    console.warn('Failed to dispose resource:', e);
                }
                this.trackedResources.delete(resource);
            }
        }

        Profiler.end('Collection');

        console.log('Collected');
    }

    private markResource(resource: DisposableResource) {
        const info = this.trackedResources.get(resource);
        if (info) {
            info.lastMarked = this.currentGeneration;
        } else {
            console.log('Untracked', resource.name, resource);
            this.trackedResources.set(resource, { refCount: 0, lastMarked: this.currentGeneration });
        }
    }
}
