import * as THREE from 'three';
import { Entity } from './Entity.js';

export class Collectible extends Entity {
    constructor({ scene, position }) {
        super({ scene, position });
        this.radius = 0.8;
        this.offset = Math.random() * 100; // For unique animation timing
    }

    createMesh() {
        const group = new THREE.Group();
        
        // Bottle body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Neck
        const neckGeo = new THREE.CylinderGeometry(0.1, 0.3, 0.4, 8);
        const neck = new THREE.Mesh(neckGeo, bodyMat);
        neck.position.y = 0.7;
        group.add(neck);
        
        // Message inside (white paper)
        const paperGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
        const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const paper = new THREE.Mesh(paperGeo, paperMat);
        group.add(paper);

        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });
        return group;
    }

    update(dt) {
        this.mesh.rotation.y += dt * 2.0;
        this.mesh.position.y = Math.sin(Date.now() * 0.005 + this.offset) * 0.3 + 0.5;
    }
}
