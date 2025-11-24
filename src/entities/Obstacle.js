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
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00aa00, roughness: 0.8 });
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

            // Tail
            const tailGeo = new THREE.BoxGeometry(0.6, 0.3, 2);
            const tail = new THREE.Mesh(tailGeo, bodyMat);
            tail.position.z = 2.5;
            group.add(tail);

        } else if (this.type === 'tire') {
            const geo = new THREE.TorusGeometry(0.6, 0.25, 16, 32);
            const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = Math.PI / 2; // Lay flat
            group.add(mesh);

        } else if (this.type === 'beachball') {
            const geo = new THREE.SphereGeometry(0.5, 16, 16);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0xff0000, 
                roughness: 0.4,
                metalness: 0.1
            });
            // Simple stripes via vertex colors would be better, but solid color for now
            // Or maybe multiple segments? Let's stick to simple red ball for now or random color
            mat.color.setHSL(Math.random(), 1.0, 0.5);
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);

        } else if (this.type === 'log') {
            const length = 3 + Math.random() * 2;
            const radius = 0.4 + Math.random() * 0.2;
            const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 1.0 });
            const mesh = new THREE.Mesh(geo, mat);
            // Random rotation handled in update or init?
            // Let's rotate the mesh here to align with Z then rotate group
            mesh.rotation.x = Math.PI / 2; 
            mesh.rotation.z = Math.random() * Math.PI; // Random roll
            group.add(mesh);
            
            // Adjust collision radius roughly
            this.radius = length * 0.4; 
        } else { // 'trash' fallback
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

    update(dt, playerPosition) {
        // Bobbing
        this.mesh.position.y = Math.sin(Date.now() * 0.005 + this.offset) * 0.1;
        
        if (this.type === 'crocodile') {
            // Swim towards player if close
            if (playerPosition) {
                const dist = this.position.distanceTo(playerPosition);
                if (dist < 30) {
                    const dir = new THREE.Vector3().subVectors(playerPosition, this.position).normalize();
                    dir.y = 0;
                    // Move
                    this.position.add(dir.multiplyScalar(dt * 2.0)); // Swim speed
                    // Rotate to face player
                    const angle = Math.atan2(dir.x, dir.z);
                    this.mesh.rotation.y = angle + Math.PI; // Model faces -Z?
                }
            }
        } else if (this.type === 'tire' || this.type === 'log') {
            // Just float
        } else if (this.type === 'beachball') {
            // Bob higher
            this.mesh.position.y = Math.sin(Date.now() * 0.005 + this.offset) * 0.2 + 0.2;
        } else {
            this.mesh.rotation.y += dt * 0.5;
        }
        
        // Sync mesh position (since we might have moved it in logic)
        this.mesh.position.x = this.position.x;
        this.mesh.position.z = this.position.z;
        // y is handled by bobbing above
    }
}
