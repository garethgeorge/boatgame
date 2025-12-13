import * as THREE from 'three';

export class GraphicsUtils {

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

}
