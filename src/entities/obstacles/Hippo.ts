import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { Boat } from '../Boat';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { AttackAnimalWater } from '../behaviors/AttackAnimal';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';

export class Hippo extends Entity implements AttackAnimalWater {

    private mixer: THREE.AnimationMixer | null = null;
    private behavior: EntityBehavior | null = null;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super();

        // Hippo can cause penalties when hit
        this.canCausePenalty = true;

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

        // Use standard water attack behavior
        this.behavior = new AttackAnimalWaterBehavior(this, 0.5);
    }

    getPhysicsBody(): planck.Body | null {
        if (this.physicsBodies.length === 0) return null;
        return this.physicsBodies[0];
    }

    waterAttackUpdateIdle(dt: number) {
        if (this.meshes.length > 0) {
            const mesh = this.meshes[0];
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, dt * 5);
            mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, dt * 5);
            // Sit lower in water (0.0)
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.0, dt * 2);
        }
    }

    waterAttackUpdatePreparing(dt: number) {
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
    }

    waterAttackUpdateAttacking(dt: number) {
        if (this.meshes.length > 0) {
            const mesh = this.meshes[0];
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, dt * 10);
            mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, dt * 10);
            // Ensure at surface
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.5, dt * 5);
        }
    }

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

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

}
