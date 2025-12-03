import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

export class Alligator extends Entity {
    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
        model.position.y = -1.0;

        if (this.meshes.length > 0) {
            this.meshes[0].add(model);
        }

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
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

        const alligatorData = Decorations.getAlligator();
        if (alligatorData) {
            this.applyModel(alligatorData.model, alligatorData.animations);
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

    private state: 'IDLE' | 'TURNING' | 'ATTACKING' = 'IDLE';

    // New method to set target
    setTarget(target: planck.Vec2) {
        if (this.physicsBodies.length === 0) return;
        const physicsBody = this.physicsBodies[0];

        const pos = physicsBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        // Reset if player goes far away
        if (dist > 50) {
            this.state = 'IDLE';
        }

        if (dist < 30) { // Aggro range
            // Calculate desired angle
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            const currentAngle = physicsBody.getAngle();
            let angleDiff = desiredAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            if (this.state === 'IDLE') {
                this.state = 'TURNING';
            } else if (this.state === 'TURNING') {
                // Rotate towards target
                const rotationSpeed = 0.05; // Very slow turn
                physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));

                // Drag to stop movement while turning
                physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.9));

                // Check if facing target (within ~15 degrees = 0.26 rad)
                if (Math.abs(angleDiff) < 0.26) {
                    this.state = 'ATTACKING';
                }
            } else if (this.state === 'ATTACKING') {
                diff.normalize();
                // Move towards target
                const speed = 8.0; // Faster drift
                const force = diff.mul(speed * physicsBody.getMass());
                physicsBody.applyForceToCenter(force);

                // Continue rotating to track
                const rotationSpeed = 0.05;
                physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));
            }
        }
    }
}
