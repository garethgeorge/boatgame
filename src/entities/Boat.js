import * as THREE from 'three';
import { BoatPhysics } from '../physics/BoatPhysics.js';

export class Boat {
    constructor(scene) {
        this.scene = scene;
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
        
        this.physics = new BoatPhysics();
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
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
        const physicsState = this.physics.update(dt, input, this.rotation);
        
        // Constrain to river
        if (riverGenerator) {
            const riverTangent = riverGenerator.getRiverTangent(this.position.z);
            this.physics.constrainToRiver(this.rotation, riverTangent);
            
            const riverCenter = riverGenerator.getRiverCenter(this.position.z);
            const riverWidth = riverGenerator.riverPath.getWidthAt(this.position.z);
            this.physics.checkWallCollisions(this.position, riverCenter, riverWidth);
        }
        
        // Update position
        this.position.add(physicsState.velocity.clone().multiplyScalar(dt));
        this.rotation += physicsState.angularVelocity * dt;

        // Sync mesh
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Simple bobbing animation
        this.mesh.position.y = Math.sin(Date.now() * 0.003) * 0.1;
        this.mesh.rotation.z = Math.sin(Date.now() * 0.002) * 0.05 - (physicsState.angularVelocity * 0.5); // Bank into turns
        this.mesh.rotation.x = -physicsState.velocity.length() * 0.01; // Pitch up with speed
    }
}
