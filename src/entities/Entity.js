import * as THREE from 'three';

/**
 * @class Entity
 * @description A base class for all objects in the game world.
 */
export class Entity {
    /**
     * @param {object} options
     * @param {THREE.Scene} options.scene - The scene to which the entity's mesh will be added.
     * @param {THREE.Vector3} [options.position] - The initial position of the entity.
     */
    constructor({ scene, position }) {
        if (!scene) {
            throw new Error('An entity must be provided with a scene.');
        }
        this.scene = scene;
        this.position = position || new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        
        this.radius = 0; // For collision detection
        
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
    createMesh() {
        // Default: an invisible point. Should be overridden.
        return new THREE.Object3D();
    }

    /**
     * @abstract
     * @param {number} dt - The delta time since the last frame.
     */
    update(dt) {
        // To be implemented by subclasses for animations, etc.
    }

    /**
     * @description Removes the entity's mesh from the scene and disposes of its resources.
     */
    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            // Dispose of geometry and material to free up memory
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(m => m.dispose());
                } else {
                    this.mesh.material.dispose();
                }
            }
        }
    }
}
