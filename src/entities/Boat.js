import * as THREE from 'three';
import { Entity } from './Entity.js';
import { BoatPhysics } from '../physics/BoatPhysics.js';

export class Boat extends Entity {
    constructor(scene) {
        super({ scene, position: new THREE.Vector3(0, 0, 0) });
        this.physics = new BoatPhysics();
        this.rotation = Math.PI; // Y-axis rotation, start facing downriver
        this.radius = 1.0; // Collision radius
    }

    createMesh() {
        const group = new THREE.Group();

        // Hull
        const hullGeometry = new THREE.BoxGeometry(1.5, 0.5, 3);
        const hullMaterial = new THREE.MeshStandardMaterial({ color: 0xff4400 });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        hull.position.y = 0.25;
        hull.castShadow = true;
        group.add(hull);

        // Cabin
        const cabinGeometry = new THREE.BoxGeometry(1, 0.8, 1.5);
        const cabinMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.y = 0.75;
        cabin.position.z = -0.5;
        cabin.castShadow = true;
        group.add(cabin);

        return group;
    }

    update(dt, input, riverGenerator) {
        let riverTangent = null;
        if (riverGenerator) {
            riverTangent = riverGenerator.getRiverTangent(this.position.z);
        }

        const physicsState = this.physics.update(dt, input, this.rotation, riverTangent);
        
        // Constrain to river walls
        if (riverGenerator) {
            const riverCenter = riverGenerator.getRiverCenter(this.position.z);
            const riverWidth = riverGenerator.riverPath.getWidthAt(this.position.z);
            this.physics.checkWallCollisions(this.position, riverCenter, riverWidth);
        }
        
        // Update position from physics
        this.position.add(physicsState.velocity.clone().multiplyScalar(dt));
        this.rotation += physicsState.angularVelocity * dt;

        // Sync mesh to this entity's position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Visual effects
        this.mesh.position.y = Math.sin(Date.now() * 0.003) * 0.1;
        
        const maxBankAngle = 0.5;
        let bankAngle = -physicsState.angularVelocity * 0.3;
        bankAngle = Math.max(-maxBankAngle, Math.min(maxBankAngle, bankAngle));
        this.mesh.rotation.z = Math.sin(Date.now() * 0.002) * 0.05 + bankAngle;

        this.mesh.rotation.x = physicsState.velocity.length() * 0.005;
    }
}
