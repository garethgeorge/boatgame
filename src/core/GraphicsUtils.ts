import * as THREE from 'three';
import { GraphicsTracker, DisposableResource } from './GraphicsTracker';

export class GraphicsUtils {
    public static readonly tracker = new GraphicsTracker();

    /**
     * Registers an object hierarchy with the graphics tracker.
     * Call this:
     * 
     * - After loading a model from an external file
     * - For materials, geometries, and textures that are cached
     *   or stored in a JavaScript class.
     */
    public static registerObject(object: THREE.Object3D | DisposableResource) {
        this.tracker.track(object);
    }

    /**
     * Indicates that the object will be discarded and not reused.
     * Disposes any referenced resources that will be discarded as a
     * result. Call this:
     * 
     * - When an object is being disposed
     * - For materials, geometries, and textures that were registered
     *   and are no longer needed.
     */
    public static disposeObject(object: THREE.Object3D | DisposableResource) {
        this.tracker.untrack(object);
    }

    /**
     * Safely assigns a new material to a mesh, updating reference counts.
     * DO NOT directly assign materials, always use this function.
     */
    public static assignMaterial(mesh: THREE.Mesh | THREE.Sprite | THREE.Line | THREE.Points, newMaterial: THREE.Material | THREE.Material[]) {

        // Retain new
        if (newMaterial) {
            if (Array.isArray(newMaterial)) {
                newMaterial.forEach(m => this.tracker.track(m));
            } else {
                this.tracker.track(newMaterial);
            }
        }

        // Release old
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => this.tracker.untrack(m));
            } else {
                this.tracker.untrack(mesh.material);
            }
        }

        // Assign new
        mesh.material = newMaterial;
    }

    /**
     * Safely assigns a new geometry to a mesh, updating reference counts.
     * DO NOT directly assign geometry, always use this function.
     */
    public static assignGeometry(mesh: THREE.Mesh | THREE.Line | THREE.Points, newGeometry: THREE.BufferGeometry) {
        if (newGeometry) {
            this.tracker.track(newGeometry);
        }

        if (mesh.geometry) {
            this.tracker.untrack(mesh.geometry);
        }

        mesh.geometry = newGeometry;

    }

    /**
     * Creates a new tracked Mesh.
     * DO NOT create directly, always use this function.
     */
    public static createMesh(geometry?: THREE.BufferGeometry, material?: THREE.Material | THREE.Material[]): THREE.Mesh {
        const mesh = new THREE.Mesh(geometry, material);
        this.tracker.track(mesh);
        return mesh;
    }

    /**
     * Creates a new tracked Line.
     * DO NOT create directly, always use this function.
     */
    public static createLine(geometry?: THREE.BufferGeometry, material?: THREE.Material): THREE.Line {
        const line = new THREE.Line(geometry, material);
        this.tracker.track(line);
        return line;
    }

    /**
     * Creates a new tracked Sprite.
     * DO NOT create directly, always use this function.
     */
    public static createSprite(material?: THREE.SpriteMaterial): THREE.Sprite {
        const sprite = new THREE.Sprite(material);
        this.tracker.track(sprite);
        return sprite;
    }

    /**
     * Clones an object ensuring referenced resources are tracked
     * correctly. Always recursive as we assume this creates new references
     * to all geometry and materials.
     * DO NOT clone directly, always use this function.
     */
    public static cloneObject<T extends THREE.Object3D>(object: T): T {
        const clone = object.clone(true) as T;
        this.tracker.track(clone);
        return clone;
    }

    /**
     * Replaces all materials with toon material ensuring correct
     * tracking of resources.
     */
    public static toonify(model: THREE.Group) {
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Replace material with MeshToonMaterial
                const originalMaterial = child.material as THREE.Material;
                let colorTexture: THREE.Texture | null = null;

                // Extract the color texture (map) from the original material
                if ('map' in originalMaterial) {
                    colorTexture = (originalMaterial as any).map;
                }

                // Create new MeshToonMaterial with the original texture
                const toonMaterial = new THREE.MeshToonMaterial({
                    name: `Toon Material: ${originalMaterial.name || 'unnamed'}`,
                    map: colorTexture,
                    gradientMap: this.getToonGradientMap(),
                    toneMapped: false,
                });

                // Use safe assignment helper
                // But wait, the child came from 'model' which MUST have been registered already 
                // if we are following the rule.
                // If model was just loaded and registered, child.material has a ref count.
                // So assignMaterial will correctly decrement it and increment toonMaterial.

                this.assignMaterial(child, toonMaterial);
            }
        });
    }

    /**
     * Clones all materials ensuring correct tracking of resources. This
     * ensures the materials are not shared so their properties can
     * safely by changed for example by an animation that targets the
     * materials.
     */
    public static cloneMaterials(mesh: THREE.Object3D) {
        // Prepare materials for fading (clone and ensure transparent)
        mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                // We use assignment helper, but we need to construct the new array first
                const newMaterials = materials.map(m => {
                    const clone = m.clone();
                    clone.name = `${m.name || 'unnamed'} (cloned)`;
                    clone.transparent = true;
                    // Note: clone() creates a fresh object with ref count 0 effectively (untouched by tracker yet)
                    // We don't manually retain here because assignMaterial will do it.
                    return clone;
                });

                if (Array.isArray(child.material)) {
                    this.assignMaterial(child, newMaterials);
                } else {
                    this.assignMaterial(child, newMaterials[0]);
                }
            }
        });
    }

    public static setMaterialOpacity(mesh: THREE.Object3D, opacity: number) {
        mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((m: THREE.Material) => {
                    m.opacity = opacity;
                });
            }
        });
    }

    private static toonGradientMap: THREE.Texture = null;

    private static getToonGradientMap(): THREE.Texture {
        if (!this.toonGradientMap) {
            this.toonGradientMap = this.createToonGradientMap();
            this.registerObject(this.toonGradientMap);
        }
        return this.toonGradientMap;
    }

    private static createToonGradientMap(): THREE.Texture {

        // Works well for models... essentially two colors
        // but with a smooth transition
        const gradientA = [0.3, 0.3, 0.85, 0.9, 0.95, 1.0];

        const colors = gradientA;

        const width = colors.length;
        const height = 1;
        const data = new Uint8Array(4 * width * height); // 4 values (RGBA) per pixel

        // Populate the array with the gradient data
        for (let i = 0; i < width; i++) {
            const color = Math.max(0, Math.min(255, Math.round(colors[i] * 255)));
            const stride = i * 4;
            data[stride] = color;     // R
            data[stride + 1] = color; // G
            data[stride + 2] = color; // B
            data[stride + 3] = 255;      // A (full opacity)
        }

        // Create the DataTexture
        const texture = new THREE.DataTexture(
            data,
            width,
            height,
            THREE.RGBAFormat
        );
        texture.name = 'Toon Gradient Map';

        // Important: The texture needs to be updated after creation if data is modified later, 
        // but for static data defined at creation, this is good practice.
        texture.needsUpdate = true;

        // Crucial for toon shading:
        // To get sharp color bands, the min and mag filters should be set to NearestFilter
        // or you can use LinearFilter for a slightly smoother (but still stepped) look.
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Prevents texture repetition
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return texture;
    }

}
