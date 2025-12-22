import * as THREE from 'three';

type DisposableResource = THREE.Material | THREE.BufferGeometry | THREE.Texture;

/**
 * Tracks reference counts for Three.js resources.
 * This class is internal to the graphics system. 
 * Use GraphicsUtils for public API.
 */
export class GraphicsTracker {
    private trackedResources = new Map<DisposableResource, number>();

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
        });
    }

    /**
     * Recursively releases resources for an object hierarchy.
     * This is called when an object is destroyed.
     */
    public untrack(root: THREE.Object3D | DisposableResource) {
        this.visit(root, (resource) => {
            this.release(resource);
        });
    }

    /**
     * Explicitly retain a specific resource.
     */
    private retain(resource: DisposableResource) {
        const count = this.trackedResources.get(resource) || 0;
        this.trackedResources.set(resource, count + 1);
    }

    /**
     * Explicitly release a specific resource.
     */
    private release(resource: DisposableResource) {
        const count = this.trackedResources.get(resource);
        if (count !== undefined) {
            const newCount = count - 1;
            if (newCount <= 0) {
                this.trackedResources.delete(resource);
                try {
                    resource.dispose();
                } catch (e) {
                    console.warn('Failed to dispose resource:', e);
                }
            } else {
                this.trackedResources.set(resource, newCount);
            }
        }
    }

    private visit(item: DisposableResource | THREE.Object3D,
        apply: (resource: DisposableResource) => void) {

        if (!item) return;

        if ((item as any).isObject3D) {
            (item as THREE.Object3D).traverse((child) => {
                this.visitObject(child, apply);
            });
        } else if ((item as any).isMaterial) {
            this.visitMaterial(item as THREE.Material, apply);
        } else if ((item as any).isBufferGeometry || (item as any).isTexture) {
            // It's a resource itself
            apply(item as DisposableResource);
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

    // Deprecated methods removed.
}
