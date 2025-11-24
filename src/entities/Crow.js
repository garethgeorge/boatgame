import * as THREE from 'three';
import { Entity } from './Entity.js';

export class Crow extends Entity {
    constructor({ scene, position }) {
        super({ scene, position });
        
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        this.originalY = position.y;
        this.isFlying = false;
        this.flightSpeed = 10;
        this.flightDirection = new THREE.Vector3(0, 1, 0);
    }

    createMesh() {
        const group = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.ConeGeometry(0.2, 0.5, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);

        // Wings
        const wingGeo = new THREE.BoxGeometry(0.8, 0.05, 0.3);
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const wings = new THREE.Mesh(wingGeo, wingMat);
        wings.position.y = 0.1;
        group.add(wings);

        group.castShadow = true;
        return group;
    }

    update(dt, playerPosition) {
        if (!this.mesh) return;

        if (this.isFlying) {
            // Fly up and away
            this.mesh.position.add(this.flightDirection.clone().multiplyScalar(this.flightSpeed * dt));
            this.mesh.position.y += 2 * dt;
            
            // Flap wings (simple scaling)
            const wingScale = Math.sin(Date.now() * 0.02) * 0.5 + 1;
            this.mesh.children[1].scale.y = wingScale; // Actually scale thickness or rotate? 
            // Let's rotate wings if they were separate, but scaling Y of a box is weird for flapping.
            // Let's just bob the whole bird for now or rotate it.
            this.mesh.rotation.z = Math.sin(Date.now() * 0.02) * 0.2;

        } else if (playerPosition) {
            // Check distance to player
            const dist = this.mesh.position.distanceTo(playerPosition);
            if (dist < 15) {
                this.isFlying = true;
                // Fly away from player
                this.flightDirection.subVectors(this.mesh.position, playerPosition).normalize();
                this.flightDirection.y = 0.5; // Ensure upward component
                this.flightDirection.normalize();
                
                // Face flight direction
                const target = this.mesh.position.clone().add(this.flightDirection);
                this.mesh.lookAt(target);
            }
        }
    }
}
