import * as planck from 'planck';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Hippo extends Entity {


    private static cachedModel: THREE.Group | null = null;
    private static cachedAnimations: THREE.AnimationClip[] = [];
    private static loadPromise: Promise<void> | null = null;

    public static async preload(): Promise<void> {
        if (this.cachedModel) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load('assets/hippo-model-1.glb', (gltf) => {
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
                console.error('An error occurred loading the hippo model:', error);
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

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        // Physics
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 2.0,
            angularDamping: 1.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.5, 3.0), // 2m wide, 6m long (Similar to alligator)
            density: 5.0,
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'hippo', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        mesh.position.y = 0.5; // Raised by ~15% of model height

        if (Hippo.cachedModel) {
            this.applyModel(Hippo.cachedModel, Hippo.cachedAnimations);
        } else {
            // Fallback if not preloaded (though it should be)
            Hippo.preload().then(() => {
                if (Hippo.cachedModel) {
                    this.applyModel(Hippo.cachedModel, Hippo.cachedAnimations);
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
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            const currentAngle = physicsBody.getAngle();

            // Simple lerp for rotation
            // Calculate shortest angle difference
            let angleDiff = desiredAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            const rotationSpeed = 0.1; // How quickly it turns
            physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));
        }
    }
}
