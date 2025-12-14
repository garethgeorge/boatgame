import * as THREE from 'three';

export class GraphicsUtils {

    // Replace all materials with toon material
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
                    map: colorTexture,
                    gradientMap: this.getToonGradientMap(),
                    toneMapped: false,
                });

                child.material = toonMaterial;
            }
        });
    }

    // To animate material properties of a shared mesh, we need to clone the materials.
    public static cloneMaterials(mesh: THREE.Object3D) {
        // Prepare materials for fading (clone and ensure transparent)
        mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const newMaterials = materials.map(m => {
                    const clone = m.clone();
                    clone.transparent = true;
                    return clone;
                });
                if (Array.isArray(child.material)) {
                    child.material = newMaterials;
                } else {
                    child.material = newMaterials[0];
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
        if (!this.toonGradientMap)
            this.toonGradientMap = this.createToonGradientMap();
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
