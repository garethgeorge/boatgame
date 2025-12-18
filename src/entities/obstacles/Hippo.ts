import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class Hippo extends AttackAnimal {

    protected get heightInWater(): number {
        return -0.5;
    }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super(physicsEngine, 'hippo', { x, y, angle, onShore: false }, {
            halfWidth: 1.5,
            halfLength: 3.0,
            density: 5.0,
            friction: 0.1,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
    }

    protected getModelData() {
        return Decorations.getHippo();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
        model.position.y = -0.2;
    }

    protected getSwimmingAnimationName(): string {
        return 'swimming';
    }

    protected getWalkingAnimationName(): string {
        return this.getSwimmingAnimationName();
    }

    protected getAnimationTimeScale(): number {
        return 2.0;
    }

    waterAttackUpdateIdle(dt: number) {
        if (this.meshes.length > 0) {
            const mesh = this.meshes[0];
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, dt * 5);
            mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, dt * 5);
            // Sit lower in water (0.0)
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, -0.5, dt * 2);
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
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.8, dt * 2);
        }
    }

    waterAttackUpdateAttacking(dt: number) {
        if (this.meshes.length > 0) {
            const mesh = this.meshes[0];
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, dt * 10);
            mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, dt * 10);
            // Ensure at surface
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.8, dt * 5);
        }
    }
}
