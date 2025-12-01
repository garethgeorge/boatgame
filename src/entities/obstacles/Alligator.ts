import * as planck from 'planck';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Alligator extends Entity {


    private static cachedModel: THREE.Group | null = null;
    private static cachedAnimations: THREE.AnimationClip[] = [];
    private static loadPromise: Promise<void> | null = null;

    public static async preload(): Promise<void> {
        if (this.cachedModel) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load('assets/alligator-model-1.glb', (gltf) => {
                const model = gltf.scene;

                // Adjust scale and rotation to match physics body
                model.scale.set(3.0, 3.0, 3.0);
                model.rotation.y = Math.PI; // Rotate 180 degrees if it faces backwards
                model.position.y = -0.2;

                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this.cachedModel = model;
                this.cachedAnimations = gltf.animations || [];
                resolve();
            }, undefined, (error) => {
                console.error('An error occurred loading the alligator model:', error);
                reject(error);
            });
        });

        return this.loadPromise;
    }

    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        const clonedModel = SkeletonUtils.clone(model);
        if (this.meshes.length > 0) {
            this.meshes[0].add(clonedModel);
        }

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(clonedModel);
            // Randomize speed between 1.8 and 2.2
            this.mixer.timeScale = 1.8 + Math.random() * 0.4;
            const action = this.mixer.clipAction(animations[0]);
            // Randomize start time
            action.time = Math.random() * action.getClip().duration;
            action.play();
        }
    }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super();

        // Physics
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            angle: angle,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.0, 3.0), // 2m wide, 6m long (Doubled)
            density: 5.0,
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'alligator', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        mesh.position.y = 0.5; // Raised by ~15% of model height

        if (Alligator.cachedModel) {
            this.applyModel(Alligator.cachedModel, Alligator.cachedAnimations);
        } else {
            // Fallback if not preloaded (though it should be)
            Alligator.preload().then(() => {
                if (Alligator.cachedModel) {
                    this.applyModel(Alligator.cachedModel, Alligator.cachedAnimations);
                }
            });
        }
    }

    private mixer: THREE.AnimationMixer | null = null;

    onHit() {
        this.shouldRemove = true;
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }

        if (this.physicsBodies.length === 0) {
            // Sinking animation
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.position.y -= dt * 2;
                if (mesh.position.y < -2) {
                    this.shouldRemove = true;
                }
            }
            return;
        }

        // Swim towards player (simplified: just move forward slowly and rotate occasionally?)
        // Or just move forward in its current direction
        // For now, let's just make it drift and snap

        // Mouth Animation (Upper Jaw moves) - REMOVED for GLB model
        /*
        this.mouthTimer += dt;
        if (this.mouthTimer > 1.0) {
          this.mouthOpen = !this.mouthOpen;
          this.mouthTimer = 0;
        }
        */

        // Access the upper jaw pivot - REMOVED for GLB model
        /*
        // Find headGroup
        // body (0), ridge*6 (1-6), tail (7), headGroup (8).
        const headGroup = this.mesh.children[8]; // Assuming headGroup is the 9th child (index 8)
        if (headGroup && headGroup.children.length > 2) {
          const upperJawPivot = headGroup.children[2];
          // Invert direction: Rotate UP (positive X)
          const targetRot = this.mouthOpen ? 0.4 : 0;
          upperJawPivot.rotation.x = THREE.MathUtils.lerp(upperJawPivot.rotation.x, targetRot, dt * 5);
        }
        */

        // AI: Swim towards player
        // We need player position. Currently update(dt) doesn't receive player pos.
        // We can pass it in EntityManager or just cheat and find 'player' userData in physics world?
        // Or just make them swim forward relative to themselves, and maybe turn slowly?
        // Let's make them swim towards the boat if close.

        // For now, let's just make them swim forward in the river flow direction (approx +Z)
        // But they face +Z initially.
        // Let's add a simple "seek" behavior if we can access player.
        // Since we don't have player ref easily here without changing signature, 
        // let's just make them patrol or swim forward.
        // User asked for "slowly swim towards the player".
        // I'll update EntityManager to pass player position or target.

        // ... wait, I can't easily change Entity.update signature across all entities without touching them all.
        // But I can add a method setTarget(target: Entity) or similar.
        // Or just look for the player in the physics world bodies list? Expensive.
        // Let's just make them move forward for now, and I'll update EntityManager in next step to pass player.
    }

    // New method to set target
    setTarget(target: planck.Vec2) {
        if (this.physicsBodies.length === 0) return;
        const physicsBody = this.physicsBodies[0];

        const pos = physicsBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        if (dist < 30) { // Aggro range
            diff.normalize();
            // Move towards target
            const speed = 2.0;
            const force = diff.mul(speed * physicsBody.getMass());
            physicsBody.applyForceToCenter(force);

            // Rotate towards target
            // In planck.js, angle 0 typically means the body's local X-axis points along global X.
            // If our model's forward is -Y (in 2D planck space), then its angle is PI/2.
            // We want the body's forward vector (which is (0, -1) in its local space) to align with 'diff'.
            // The angle of vector (x, y) is atan2(y, x).
            // The angle of (0, -1) is -PI/2.
            // So, desiredAngle = atan2(diff.y, diff.x) - (-PI/2) = atan2(diff.y, diff.x) + PI/2.
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            const currentAngle = physicsBody.getAngle();

            // Simple lerp for rotation
            // Calculate shortest angle difference
            let angleDiff = desiredAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            const rotationSpeed = 0.1; // How quickly it turns
            physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60)); // Adjust for dt if needed, but setAngularVelocity is per-frame
        }
    }
}
