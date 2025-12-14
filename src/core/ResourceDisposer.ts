import * as THREE from 'three';

export interface Disposable {
  dispose(): void;
}

export class ResourceDisposer {
  private disposables: Disposable[] = [];

  public add(item: Disposable | Disposable[] | null | undefined) {
    if (!item) return;

    if (Array.isArray(item)) {
      item.forEach(i => this.add(i));
      return;
    }

    this.disposables.push(item);
  }

  public addThreeObject(object: THREE.Object3D) {
    // this.add(object); // Object3D doesn't have dispose, but we might want to track it for scene removal? 
    // Actually, Object3D relies on geometry/material disposal.
    // Helper to traverse and collect disposables from an object tree
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          this.add(child.geometry);
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => this.addMaterial(m));
          } else {
            this.addMaterial(child.material);
          }
        }
      }
    });
  }

  public addMaterial(material: THREE.Material) {
    this.add(material);
    // automatically handle textures that might be attached
    // This is heuristic, standard materials have map, normalMap, etc.
    // ShaderMaterials might have uniforms with textures.
    // MeshToonMaterial has gradientMap.

    const mat = material as any;
    if (mat.gradientMap) this.add(mat.gradientMap);
    if (mat.map) this.add(mat.map);
    if (mat.normalMap) this.add(mat.normalMap);
    if (mat.specularMap) this.add(mat.specularMap);
    if (mat.envMap) this.add(mat.envMap);
    if (mat.alphaMap) this.add(mat.alphaMap);
    if (mat.aoMap) this.add(mat.aoMap);
    if (mat.displacementMap) this.add(mat.displacementMap);
    if (mat.emissiveMap) this.add(mat.emissiveMap);
    if (mat.metalnessMap) this.add(mat.metalnessMap);
    if (mat.roughnessMap) this.add(mat.roughnessMap);
  }

  public dispose() {
    // Process in reverse order (LIFO) - typical suitable pattern
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        this.disposables[i].dispose();
      } catch (e) {
        console.warn("Failed to dispose resource:", e);
      }
    }
    this.disposables = [];
  }
}
