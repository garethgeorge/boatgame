import * as THREE from 'three';

/**
 * @class Entity
 * @description A base class for all objects in the game world.
 */
export interface EntityOptions {
    scene: THREE.Scene;
    position?: THREE.Vector3;
}

export class Entity {
    scene: THREE.Scene;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    radius: number;
    mesh: THREE.Object3D;
    markForRemoval: boolean = false;
    active: boolean = true;

    constructor({ scene, position }: EntityOptions) {
        if (!scene) {
            throw new Error('An entity must be provided with a scene.');
        }
        this.scene = scene;
        this.position = position || new THREE.Vector3();
        this.velocity = new THREE.Vector3();

        this.radius = 1.0; // For collision detection

        this.mesh = this.createMesh();
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.scene.add(this.mesh);
        }
    }

    /**
     * @abstract
     * @description This method should be overridden by subclasses to create the entity's 3D mesh.
     * @returns {THREE.Object3D}
     */
    createMesh(): THREE.Object3D {
        // Default: an invisible point. Should be overridden.
        return new THREE.Object3D();
    }

    /**
     * @abstract
     * @param {number} dt - The delta time since the last frame.
     */
    update(dt: number, ...args: any[]) {
        // To be implemented by subclasses for animations, etc.
    }

    /**
     * @description Removes the entity's mesh from the scene and disposes of its resources.
     */
    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            // Dispose of geometry and material to free up memory
            const mesh = this.mesh as THREE.Mesh;
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }
    }
}
