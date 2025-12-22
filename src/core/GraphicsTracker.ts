import * as THREE from 'three';
import { Profiler } from './Profiler';

type DisposableResource = THREE.Material | THREE.BufferGeometry | THREE.Texture;

export class GraphicsTracker {
    private trackedResources = new Map<DisposableResource, { refCount: number, lastMarked: number }>();
    private currentGeneration = 0;
    private isPaused = false;

    private visit(item: DisposableResource | THREE.Object3D,
        apply: (resource: DisposableResource) => void) {

        if (!item) return;

        if (item instanceof THREE.Object3D) {
            item.traverse((child) => {
                this.visitObject(child, apply);
            });
        } else if (item instanceof THREE.Material) {
            this.visitMaterial(item, apply);
        } else {
            apply(item as DisposableResource);
        }

    }

    private visitObject(obj: THREE.Object3D, apply: (resource: DisposableResource) => void) {
        const anyObj = obj as any;
        if (anyObj.geometry) {
            apply(anyObj.geometry);
        }
        if (anyObj.material) {
            if (Array.isArray(anyObj.material)) {
                anyObj.material.forEach(m => this.visitMaterial(m, apply));
            } else {
                this.visitMaterial(anyObj.material, apply);
            }
        }

        // Track skeleton bone textures (crucial for SkinnedMesh instances)
        if (obj instanceof THREE.SkinnedMesh && obj.skeleton && obj.skeleton.boneTexture) {
            apply(obj.skeleton.boneTexture);
        }
    }

    private visitMaterial(material: THREE.Material,
        apply: (resource: DisposableResource) => void) {

        apply(material);

        // Track all textures attached to the material
        for (const key in material) {
            const value = (material as any)[key];
            if (value && (value instanceof THREE.Texture || (value as any).isTexture)) {
                apply(value as THREE.Texture);
            }
        }

        // Search uniforms for textures (important for ShaderMaterial)
        const uniforms = (material as any).uniforms;
        if (uniforms) {
            for (const name in uniforms) {
                const uniform = uniforms[name];
                if (uniform && uniform.value) {
                    const val = uniform.value;
                    if (val instanceof THREE.Texture || (val as any).isTexture) {
                        apply(val as THREE.Texture);
                    } else if (Array.isArray(val)) {
                        val.forEach(v => {
                            if (v && (v instanceof THREE.Texture || (v as any).isTexture)) {
                                apply(v as THREE.Texture);
                            }
                        });
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

        // Mark Phase: Scene traversal
        scene.traverse((object) => {
            this.visitObject(object, (resource) => this.markResource(resource));
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
