import * as THREE from 'three';
import { Entity } from './Entity.js';

export class Pier extends Entity {
    constructor({ scene, position, rotationY }) {
        super({ scene, position });
        this.rotationY = rotationY;
        this.radius = 2.0; // Collision radius (approximate)
        
        // Re-create mesh
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotationY;
        this.scene.add(this.mesh);
    }

    createMesh() {
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

    update(dt) {
        // Static
    }
}
