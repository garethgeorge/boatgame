import * as THREE from 'three';

export type DisposableResource = THREE.Material | THREE.BufferGeometry | THREE.Texture;

/**
 * Tracks reference counts for Three.js resources.
 * This class is internal to the graphics system. 
 * Use GraphicsUtils for public API.
 */
export class GraphicsTracker {
    public verbose: boolean = false;
    private trackedResources = new Map<DisposableResource, number>();
    private trackedLeaves = new Map<THREE.Object3D, number>();

    // Common texture slots in Three.js materials for fast lookup
    private static readonly TEXTURE_PROPERTIES = [
        'map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap', 'displacementMap',
        'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap', 'gradientMap',
        'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
        'sheenColorMap', 'sheenRoughnessMap', 'transmissionMap', 'thicknessMap',
        'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'iridescenceThicknessMap',
        'anisotropyMap'
    ];

    /**
     * Recursively tracks resources for an object and its children.
     * This is called when a new object hierarchy loaded from file
     * or cloned.
     */
    public track(root: THREE.Object3D | DisposableResource) {
        this.visit(root, (resource) => {
            this.retain(resource);
        }, (object) => {
            const isTracked = this.trackedLeaves.has(object);
            if (isTracked) {
                if (this.verbose) {
                    console.log('Already tracked', object.name, object);
                }
                return false;
            }
            this.trackedLeaves.set(object, performance.now());
            return true;
        });
    }

    /**
     * Recursively releases resources for an object hierarchy.
     * This is called when an object is destroyed.
     */
    public untrack(root: THREE.Object3D | DisposableResource) {
        this.visit(root, (resource) => {
            this.release(resource);
        }, (object) => {
            if ((this.verbose) && !this.trackedLeaves.has(object)) {
                console.log('Untracked?', object.name, object);
            }
            this.trackedLeaves.delete(object);
            return true;
        });
    }

    /**
     * Explicitly retain a specific resource.
     */
    private retain(resource: DisposableResource) {
        const count = this.trackedResources.get(resource);
        if (count === undefined) {
            if (this.verbose)
                console.log('Tracking', resource.name, resource);
            this.trackedResources.set(resource, 1);
        } else {
            this.trackedResources.set(resource, count + 1);
        }
    }

    /**
     * Explicitly release a specific resource.
     */
    private release(resource: DisposableResource) {
        const count = this.trackedResources.get(resource);
        if (count !== undefined) {
            const newCount = count - 1;
            if (newCount <= 0) {
                if (this.verbose)
                    console.log('Dispose', resource.name, resource);
                this.trackedResources.delete(resource);
                this.dispose(resource);
            } else {
                this.trackedResources.set(resource, newCount);
            }
        } else {
            if (this.verbose)
                console.log('Untracked', resource.name, resource);
            this.dispose(resource);
        }
    }

    private dispose(resource: DisposableResource) {
        try {
            resource.dispose();
        } catch (e) {
            console.warn('Failed to dispose resource:', e);
        }
    }

    private visit(item: DisposableResource | THREE.Object3D,
        visitResource: (resource: DisposableResource) => void,
        visitLeaf?: (object: THREE.Object3D) => boolean) {

        if (!item) return;

        if ((item as any).isObject3D) {
            (item as THREE.Object3D).traverse((child) => {
                this.visitObject(child, visitResource, visitLeaf);
            });
        } else if ((item as any).isMaterial) {
            this.visitMaterial(item as THREE.Material, visitResource);
        } else if ((item as any).isBufferGeometry || (item as any).isTexture) {
            // It's a resource itself
            visitResource(item as DisposableResource);
        }
    }

    private visitObject(obj: THREE.Object3D,
        visitResource: (resource: DisposableResource) => void,
        visitLeaf?: (object: THREE.Object3D) => boolean) {
        const anyObj = obj as any;

        // Skip non-renderable objects using fast internal flags.
        const isRenderable = anyObj.isMesh || anyObj.isSprite || anyObj.isLine || anyObj.isPoints;

        // The visitLeaf function can short cut traversal
        const shouldVisit = isRenderable && (visitLeaf?.(obj) ?? true);

        if (isRenderable && shouldVisit) {
            if (anyObj.geometry) visitResource(anyObj.geometry);

            const material = anyObj.material;
            if (material) {
                if (Array.isArray(material)) {
                    for (let i = 0, l = material.length; i < l; i++) {
                        this.visitMaterial(material[i], visitResource);
                    }
                } else {
                    this.visitMaterial(material, visitResource);
                }
            }

            if (anyObj.isSkinnedMesh && anyObj.skeleton?.boneTexture) {
                visitResource(anyObj.skeleton.boneTexture);
            }
        }

        if (anyObj.isSkinnedMesh && !anyObj.isMesh)
            console.log('Hmm.. skinned mesh should be a mesh!');
    }

    private visitMaterial(material: THREE.Material,
        visitResource: (resource: DisposableResource) => void) {

        visitResource(material);

        const anyMat = material as any;

        // Fast path for standard materials using predefined property keys
        const props = GraphicsTracker.TEXTURE_PROPERTIES;
        for (let i = 0, l = props.length; i < l; i++) {
            const tex = anyMat[props[i]];
            if (tex && tex.isTexture) {
                visitResource(tex);
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
                            visitResource(val);
                        } else if (Array.isArray(val)) {
                            for (let i = 0, l = val.length; i < l; i++) {
                                if (val[i]?.isTexture) visitResource(val[i]);
                            }
                        }
                    }
                }
            }
        }
    }

    // Deprecated methods removed.
}
