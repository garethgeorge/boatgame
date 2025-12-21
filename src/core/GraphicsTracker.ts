import * as THREE from 'three';

type DisposableResource = THREE.Material | THREE.BufferGeometry | THREE.Texture;

export class GraphicsTracker {
    private trackedResources = new Map<DisposableResource, { refCount: number, lastMarked: number }>();
    private currentGeneration = 0;
    private isPaused = false;

    private visit(item: DisposableResource | THREE.Object3D,
        apply: (DisposableResource) => void) {

        if (!item) return;

        if (item instanceof THREE.Object3D) {
            item.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) apply(child.geometry);
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => this.visitMaterial(m, apply));
                        } else {
                            this.visitMaterial(child.material, apply);
                        }
                    }
                }
            });
        } else {
            if (item instanceof THREE.Material) {
                this.visitMaterial(item, apply);
            } else {
                apply(item);
            }
        }
    }

    private visitMaterial(material: THREE.Material,
        apply: (DisposableResource) => void) {

        apply(material);

        // Track textures
        const mat = material as any;
        const textures = [
            mat.map, mat.normalMap, mat.specularMap, mat.envMap,
            mat.alphaMap, mat.aoMap, mat.displacementMap, mat.emissiveMap,
            mat.metalnessMap, mat.roughnessMap, mat.gradientMap
        ];
        textures.forEach(t => {
            if (t instanceof THREE.Texture) apply(t);
        });
    }

    /**
     * Register a resource or an Object3D's resources for tracking.
     */
    public register(item: DisposableResource | THREE.Object3D) {
        this.visit(item, (resource) => this.registerResource(resource));
    }

    private registerResource(resource: DisposableResource) {
        if (!this.trackedResources.has(resource)) {
            console.log('Register', resource.name, resource);
            this.trackedResources.set(resource, { refCount: 0, lastMarked: -1 });
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
        this.registerResource(resource);
        console.log('Retain', resource.name, resource);
        const info = this.trackedResources.get(resource);
        if (info) info.refCount++;
    }

    /**
     * Release a resource (decrement ref count).
     */
    public release(item: any) {
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
        console.log('Collecting');
        if (this.isPaused) {
            console.log('Paused');
            return;
        }

        this.currentGeneration++;

        // Mark Phase: Scene traversal
        scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                this.visit(object, (resource) => this.markResource(resource));
            }
        });

        // Sweep Phase
        for (const [resource, info] of this.trackedResources.entries()) {
            if (info.refCount <= 0 && info.lastMarked !== this.currentGeneration) {
                try {
                    console.log('Dispose:', resource.name, resource);
                    resource.dispose();
                } catch (e) {
                    console.warn('Failed to dispose resource:', e);
                }
                this.trackedResources.delete(resource);
            }
        }
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
