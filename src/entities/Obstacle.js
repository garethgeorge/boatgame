import * as THREE from 'three';
import { Entity } from './Entity.js';

export class Obstacle extends Entity {
    constructor({ scene, position, type }) {
        super({ scene, position });
        this.type = type;
        this.radius = 1.0;
        this.offset = Math.random() * 100;
        
        // Re-create mesh based on type
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();
        
        if (this.type === 'crocodile') {
            const bodyGeo = new THREE.BoxGeometry(1, 0.5, 3);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00aa00 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            group.add(body);
            
            const snoutGeo = new THREE.BoxGeometry(0.8, 0.4, 1.5);
            const snout = new THREE.Mesh(snoutGeo, bodyMat);
            snout.position.z = -2;
            group.add(snout);
            
            // Eyes
            const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
            leftEye.position.set(0.3, 0.4, -1.5);
            const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
            rightEye.position.set(-0.3, 0.4, -1.5);
            group.add(leftEye);
            group.add(rightEye);

        } else { // 'trash'
            const geo = new THREE.DodecahedronGeometry(0.8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
        }
        
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });
        return group;
    }

    update(dt) {
        this.mesh.position.y = Math.sin(Date.now() * 0.005 + this.offset) * 0.2;
        this.mesh.rotation.y += dt * 0.5;
    }
}
