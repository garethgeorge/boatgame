import * as THREE from 'three';
import { Entity } from './Entity.js';
import { BoatPhysics } from '../physics/BoatPhysics.js';

export class Boat extends Entity {
    constructor(scene) {
        super({ scene, position: new THREE.Vector3(0, 0, 0) });
        this.physics = new BoatPhysics();
        this.rotation = Math.PI; // Y-axis rotation, start facing downriver
        this.radius = 1.0; // Collision radius
        
        this.particles = [];
        this.particleGroup = new THREE.Group();
        this.scene.add(this.particleGroup);
    }

    createMesh() {
        const group = new THREE.Group();

        // Main Hull (Sleek and tapered)
        const hullShape = new THREE.Shape();
        hullShape.moveTo(0, 0);
        hullShape.lineTo(0.6, 0);   // Back right
        hullShape.lineTo(0.6, 2.0); // Mid right
        hullShape.lineTo(0, 3.0);   // Front tip
        hullShape.lineTo(-0.6, 2.0);// Mid left
        hullShape.lineTo(-0.6, 0);  // Back left
        hullShape.lineTo(0, 0);     // Close

        const extrudeSettings = {
            steps: 1,
            depth: 0.6,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 2
        };

        const hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
        // Center the geometry
        hullGeo.translate(0, -1.5, -0.3);
        // Rotate to lie flat
        hullGeo.rotateX(Math.PI / 2);
        
        const hullMat = new THREE.MeshStandardMaterial({ 
            color: 0xff3300, // Racing Red
            roughness: 0.2,
            metalness: 0.6
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.castShadow = true;
        group.add(hull);

        // Windshield
        const windshieldGeo = new THREE.BoxGeometry(1.0, 0.4, 0.1);
        const windshieldMat = new THREE.MeshStandardMaterial({ 
            color: 0x88ccff, 
            transparent: true, 
            opacity: 0.6,
            roughness: 0.0,
            metalness: 0.9
        });
        const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
        windshield.position.set(0, 0.6, 0.2);
        windshield.rotation.x = -Math.PI / 4;
        group.add(windshield);

        // Engine / Spoiler
        const spoilerGeo = new THREE.BoxGeometry(1.2, 0.1, 0.4);
        const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
        spoiler.position.set(0, 0.6, -1.2);
        group.add(spoiler);

        const engineGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const engine = new THREE.Mesh(engineGeo, spoilerMat);
        engine.position.set(0, 0.3, -1.4);
        group.add(engine);

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
            // Get boundary segments around the boat
            const range = 20; // Check 20 units ahead and behind
            const segments = riverGenerator.riverPath.getRiverBoundarySegments(this.position.z, range);
            
            this.physics.checkEdgeCollisions(this.position, segments, this.radius);
        }
        
        // Update position from physics
        this.position.add(physicsState.velocity.clone().multiplyScalar(dt));
        this.rotation += physicsState.angularVelocity * dt;

        // Sync mesh to this entity's position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Visual effects: Bobbing
        this.mesh.position.y = Math.sin(Date.now() * 0.003) * 0.1;
        
        // Banking
        const maxBankAngle = 0.5;
        let bankAngle = -physicsState.angularVelocity * 0.3;
        bankAngle = Math.max(-maxBankAngle, Math.min(maxBankAngle, bankAngle));
        this.mesh.rotation.z = Math.sin(Date.now() * 0.002) * 0.05 + bankAngle;

        // Pitch up with speed (positive rotation tips nose up for this model configuration?)
        const speed = physicsState.velocity.length();
        this.mesh.rotation.x = Math.min(0.2, speed * 0.01);

        // Particles (Bubbles)
        this.updateParticles(dt, speed);
    }

    updateParticles(dt, speed) {
        // Spawn particles
        if (speed > 5) {
            const spawnRate = Math.floor(speed * 2);
            for (let i = 0; i < spawnRate; i++) {
                if (Math.random() < 0.3) { // Limit density
                    this.spawnParticle();
                }
            }
        }

        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            
            if (p.life <= 0) {
                this.particleGroup.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            } else {
                p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                p.mesh.scale.multiplyScalar(0.95); // Shrink
                p.mesh.material.opacity = p.life; // Fade
            }
        }
    }

    spawnParticle() {
        const geo = new THREE.SphereGeometry(0.1 + Math.random() * 0.1, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.8 
        });
        const mesh = new THREE.Mesh(geo, mat);

        // Spawn at back of boat
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5, 
            -0.2, 
            -1.5
        );
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
        mesh.position.copy(this.position).add(offset);

        // Initial velocity (slightly random, mostly stationary relative to world, so boat leaves them behind)
        // Actually, if they are stationary in world, they just stay there.
        // Let's give them a slight drift.
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            0,
            (Math.random() - 0.5) * 0.5
        );

        this.particleGroup.add(mesh);
        this.particles.push({
            mesh: mesh,
            life: 1.0 + Math.random() * 0.5,
            velocity: velocity
        });
    }

    destroy() {
        super.destroy();
        this.scene.remove(this.particleGroup);
        this.particles.forEach(p => {
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        });
    }
}
