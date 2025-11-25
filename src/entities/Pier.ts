import * as THREE from 'three';
import { Entity, EntityOptions } from './Entity';

export interface PierOptions extends EntityOptions {
    rotationY: number;
}

export class Pier extends Entity {
    rotationY: number;
    size: THREE.Vector3;
    centerOffset: THREE.Vector3;
    hasCollided: boolean = false;

    constructor(options: PierOptions) {
        super(options);
        this.rotationY = options.rotationY;
        this.radius = 2.0; // Collision radius (approximate)
        this.size = new THREE.Vector3(3, 1, 10); // Main walkway size (approx)
        // Walkway is at z=5, size (3, 0.3, 10).
        // Center of walkway is (0, 0, 5).
        // The entity position is at the bank edge.
        // The pier extends 10 units out.
        // So the bounding box center is offset from the entity position!
        // My checkRectangularCollision assumes rectPos is the center.
        // So when checking, I need to pass (this.position + offset rotated).
        this.centerOffset = new THREE.Vector3(0, 0, 5);

        // Re-create mesh
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotationY;
        this.scene.add(this.mesh);
    }

    createMesh(): THREE.Group {
        const group = new THREE.Group();

        // Planks
        const plankGeo = new THREE.BoxGeometry(1.0, 0.2, 4.0);
        const plankMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });

        // Main walkway
        const walkway = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 10), plankMat);
        walkway.position.z = 5; // Extend out
        walkway.castShadow = true;
        group.add(walkway);

        // Posts
        const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 8);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x5C4033 });

        const positions = [
            { x: -1.2, z: 2 }, { x: 1.2, z: 2 },
            { x: -1.2, z: 5 }, { x: 1.2, z: 5 },
            { x: -1.2, z: 8 }, { x: 1.2, z: 8 }
        ];

        positions.forEach(pos => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(pos.x, -1.5, pos.z);
            post.castShadow = true;
            group.add(post);
        });

        return group;
    }

    update(dt: number) {
        // Static
    }
}
