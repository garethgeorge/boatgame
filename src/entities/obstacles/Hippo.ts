import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { Boat } from '../Boat';

export class Hippo extends Entity {
    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
        model.position.y = -0.2;

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
            shape: planck.Box(1.5, 3.0), // 2m wide, 6m long (Similar to alligator)
            density: 5.0,
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'hippo', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        mesh.position.y = 0.0; // Start lower in water

        const hippoData = Decorations.getHippo();
        if (hippoData) {
            this.applyModel(hippoData.model, hippoData.animations);
        }
    }

    private mixer: THREE.AnimationMixer | null = null;

    onHit() {
        this.shouldRemove = true;
    }

    private state: 'IDLE' | 'PREPARING' | 'CHARGING' = 'IDLE';
    private chargeTimer: number = 0;
    private hasNoticedPlayer: boolean = false;

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

        // State machine logic for charge preparation
        if (this.state === 'PREPARING') {
            this.chargeTimer -= dt;
            if (this.meshes.length > 0) {
                // Shake effect only, no tilt
                const mesh = this.meshes[0];

                // Ensure no tilt
                mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, dt * 10);

                // Smooth wobble instead of random shake
                const time = Date.now() / 50; // Speed of wobble
                const wobbleAmount = 0.05; // Amplitude
                mesh.rotation.z = Math.sin(time) * wobbleAmount;

                // Float up to 0.5
                mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.5, dt * 2);
            }
            // Transition handled in setTarget now to ensure alignment
        } else if (this.state === 'CHARGING') {
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, dt * 10);
                mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, dt * 10);
                // Ensure at surface
                mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.5, dt * 5);
            }
        } else {
            // IDLE
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, dt * 5);
                mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, dt * 5);
                // Sit lower in water (0.0)
                mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.0, dt * 2);
            }
        }

        this.updateAI();
    }

    private updateAI() {
        const targetBody = Boat.getPlayerBody();
        if (!targetBody || this.physicsBodies.length === 0) return;

        const physicsBody = this.physicsBodies[0];
        const pos = physicsBody.getPosition();
        const targetPos = targetBody.getPosition();
        const diff = targetPos.clone().sub(pos);
        const dist = diff.length();

        // Check if behind boat
        // Player forward vector
        const playerAngle = targetBody.getAngle();
        // Assuming player forward is -Y in local space (angle + PI/2) or similar?
        // Let's assume standard planck angle: 0 is +X.
        // If boat moves "forward", we need to know what "forward" is for the boat.
        // Usually in this game, the river flows +Z (down), boat moves +Z.
        // In 2D physics, let's assume +Y is "down river" or whatever the boat's forward is.
        // Actually, let's use the boat's velocity or just its angle.
        // If the boat is facing angle A, its forward vector is (cos A, sin A).
        // Wait, earlier code said "model.rotation.y = Math.PI" for obstacles, implying they face "up" river?
        // Let's rely on the angle.
        // Boat's forward vector:
        // If boat angle 0 = +X.
        // Let's assume the boat's "forward" is aligned with its local Y axis (0, 1) rotated by Angle?
        // Or local (0, -1)?
        // Let's try standard (cos(a), sin(a)) rotated by -PI/2 if it's "up"?
        // Actually, simpler: The boat moves roughly in the direction of its angle.
        // If the boat is "facing" the hippo, the hippo is "in front".
        // If the boat has passed the hippo, the hippo is "behind".
        // Vector from Boat to Hippo = HippoPos - BoatPos = -diff.
        // Dot(BoatForward, BoatToHippo) < 0 means Hippo is behind.

        // Let's assume Boat Forward is based on its angle.
        // In many top-down games, 0 is East, PI/2 is South (screen coords).
        // Let's assume standard math: Forward = (cos(angle), sin(angle)).
        // But wait, if the boat is vertical, angle might be PI/2.
        // Let's try using the angle directly.
        const forward = planck.Vec2(Math.sin(playerAngle), -Math.cos(playerAngle)); // Assuming 0 is North/Up? No, let's stick to standard.
        // Actually, let's look at how Alligator/Hippo rotate.
        // "desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;"
        // This implies that for a vector (0, 1) [down], atan2 is PI/2.
        // desiredAngle = PI/2 + PI/2 = PI.
        // So facing "down" (0, 1) is angle PI.
        // Facing "up" (0, -1) [atan2 = -PI/2] -> desired = 0.
        // So angle 0 is UP (0, -1).
        // So Forward vector for angle A is (sin(A), -cos(A))?
        // If A=0, F=(0, -1) [UP]. Correct.
        // If A=PI, F=(0, 1) [DOWN]. Correct.
        // So Forward = (-sin(angle), cos(angle))? No.
        // Let's just use the transform:
        // Rot(0) * (0, -1) = (0, -1).
        // Rot(PI/2) * (0, -1) = (1, 0) [RIGHT].
        // Rot(PI) * (0, -1) = (0, 1) [DOWN].
        // This corresponds to standard rotation matrix:
        // x' = x cos A - y sin A
        // y' = x sin A + y cos A
        // Apply to (0, -1):
        // x' = -(-1) sin A = sin A
        // y' = (-1) cos A = -cos A
        // So Forward = (sin A, -cos A).

        const playerForward = planck.Vec2(Math.sin(playerAngle), -Math.cos(playerAngle));
        const boatToHippo = pos.clone().sub(targetPos); // Hippo - Player

        // If dot product is negative, Hippo is behind the boat (boat is facing away from hippo)
        if (planck.Vec2.dot(playerForward, boatToHippo) < 0) {
            this.hasNoticedPlayer = false;
            this.state = 'IDLE';
            // Don't return, let it drift/idle
        }

        // Reset noticed state if player goes far away
        if (dist > 300) {
            this.hasNoticedPlayer = false;
            this.state = 'IDLE';
        }

        if (dist < 60) { // Aggro range
            if (this.state === 'IDLE') {
                if (!this.hasNoticedPlayer) {
                    this.hasNoticedPlayer = true;
                    // 1/2 chance to charge
                    if (Math.random() < 0.5) {
                        this.state = 'PREPARING';
                        this.chargeTimer = 0.5; // 0.5s delay
                    }
                }
            } else if (this.state === 'PREPARING') {
                // Rotate towards target while preparing
                diff.normalize();
                const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
                const currentAngle = physicsBody.getAngle();
                let angleDiff = desiredAngle - currentAngle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                // Double rotation speed: 0.5 -> 1.0
                physicsBody.setAngularVelocity(angleDiff * 1.0);

                // Drag to stop movement while preparing
                physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.9));

                // Only charge if timer is up AND we are facing the player
                if (this.chargeTimer <= 0 && Math.abs(angleDiff) < 0.26) { // ~15 degrees
                    this.state = 'CHARGING';
                }
            } else if (this.state === 'CHARGING') {
                diff.normalize();
                // Move fast towards target
                const speed = 28.0; // Super Fast charge
                const force = diff.mul(speed * physicsBody.getMass());
                physicsBody.applyForceToCenter(force);

                // Rotate towards target
                const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
                const currentAngle = physicsBody.getAngle();
                let angleDiff = desiredAngle - currentAngle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                physicsBody.setAngularVelocity(angleDiff * 1.0);
            }
        }
    }
}
