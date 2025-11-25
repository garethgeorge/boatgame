import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Entity } from './Entity';
import { BoatPhysics } from '../physics/BoatPhysics';

interface Particle {
    mesh: THREE.Mesh;
    life: number;
    velocity: THREE.Vector3;
}

export class Boat extends Entity {
    physics: BoatPhysics;
    rotation: number;
    declare radius: number;
    size: THREE.Vector3;
    particles: Particle[];
    particleGroup: THREE.Group;
    isFlashing: boolean = false;

    constructor(scene: THREE.Scene) {
        super({ scene, position: new THREE.Vector3(0, 0, 0) });
        this.physics = new BoatPhysics();
        this.rotation = Math.PI; // Y-axis rotation, start facing downriver
        this.radius = 1.0; // Collision radius (Reverted)
        this.size = new THREE.Vector3(1.2, 1.0, 3.0); // Width, Height, Length (Reverted)

        this.particles = [];
        this.particleGroup = new THREE.Group();
        this.scene.add(this.particleGroup);
    }

    createMesh(): THREE.Object3D {
        const group = new THREE.Group();

        // Temporary Debug Box (visible until model loads)
        const debugGeo = new THREE.BoxGeometry(1.2, 1.0, 3.0); // Reverted
        const debugMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true });
        const debugMesh = new THREE.Mesh(debugGeo, debugMat);
        debugMesh.position.y = 0.5; // Reverted
        group.add(debugMesh);

        // Load GLB Model
        const loader = new GLTFLoader();
        loader.load('assets/Cute_cartoon_tug_boat_1125002001_texture.glb', (gltf) => {
            const model = gltf.scene;

            // Calculate bounding box to determine scale
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);

            console.log('Boat Model Original Size:', size);

            // Target length is 6.0 (Doubled from 3.0)
            // Determine which axis is length (usually Z or X, but let's check max dimension)
            const maxDim = Math.max(size.x, size.y, size.z);
            let scaleFactor = 6.0 / maxDim;

            // If the model is tiny (e.g. unit conversion issue), adjust
            if (maxDim < 0.1) scaleFactor *= 100; // Heuristic fix if needed, but let's trust the math first

            model.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // Re-center the model
            // We need to center it based on the scaled bounding box
            const center = new THREE.Vector3();
            box.getCenter(center);
            model.position.sub(center.multiplyScalar(scaleFactor));

            // Adjust rotation (GLTF usually faces +Z, we want it to face -Z or whatever matches our game)
            // User reported previous rotation (PI/2) was backwards.
            // So we flip it 180 degrees -> -PI/2 (or 3*PI/2)
            model.rotation.y = -Math.PI / 2;

            // Raise the boat a bit
            model.position.y += 1.0;

            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                    // Store original color for flash effect
                    if (mesh.material) {
                        const material = mesh.material as THREE.MeshStandardMaterial;
                        mesh.userData.originalColor = material.color.clone();
                    }
                }
            });

            // Remove debug mesh and add model
            group.remove(debugMesh);
            debugMesh.geometry.dispose();
            (debugMesh.material as THREE.Material).dispose(); // Cast to Material for dispose

            group.add(model);
            console.log('Boat model loaded and scaled to factor:', scaleFactor);

        }, undefined, (error) => {
            console.error('An error happened loading the boat model:', error);
            // Keep debug mesh if loading fails so we see something
            (debugMesh.material as THREE.MeshStandardMaterial).color.setHex(0xff0000); // Turn red on error
        });

        return group;
    }

    flashDamage() {
        if (this.isFlashing) return; // Prevent overlapping flashes
        this.isFlashing = true;

        this.mesh.traverse(child => {
            if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
                const mesh = child as THREE.Mesh;
                const material = mesh.material as THREE.MeshStandardMaterial;
                material.color.setHex(0xff0000);
            }
        });

        setTimeout(() => {
            this.mesh.traverse(child => {
                if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material && child.userData.originalColor) {
                    const mesh = child as THREE.Mesh;
                    const material = mesh.material as THREE.MeshStandardMaterial;
                    material.color.copy(child.userData.originalColor);
                }
            });
            this.isFlashing = false;
        }, 200);
    }

    update(dt: number, input: any, riverGenerator: any) {
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

        // Banking (Lean into the turn)
        const maxBankAngle = 0.25; // Reduced from 0.5 for subtlety
        // Invert sign: Positive angular velocity (Left turn) -> Positive Z rotation (Left bank/Lean left)
        let bankAngle = physicsState.angularVelocity * 0.2; // Reduced multiplier
        bankAngle = Math.max(-maxBankAngle, Math.min(maxBankAngle, bankAngle));

        // Idle rocking (reduced)
        this.mesh.rotation.z = Math.sin(Date.now() * 0.002) * 0.02 + bankAngle;

        // Pitch up with speed (positive rotation tips nose up for this model configuration?)
        const speed = physicsState.velocity.length();
        this.mesh.rotation.x = Math.min(0.2, speed * 0.01);

        // Particles (Bubbles)
        this.updateParticles(dt, speed);
    }

    updateParticles(dt: number, speed: number) {
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
                const material = p.mesh.material as THREE.Material;
                if (Array.isArray(material)) {
                    material.forEach(m => m.dispose());
                } else {
                    material.dispose();
                }
                this.particles.splice(i, 1);
            } else {
                p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                p.mesh.scale.multiplyScalar(0.95); // Shrink
                const material = p.mesh.material as THREE.Material;
                material.opacity = p.life; // Fade
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
            const material = p.mesh.material as THREE.Material;
            if (Array.isArray(material)) {
                material.forEach(m => m.dispose());
            } else {
                material.dispose();
            }
        });
    }
}
