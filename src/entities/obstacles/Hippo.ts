import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';

export class Hippo extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -0.5;

    protected get heightInWater(): number {
        return Hippo.HEIGHT_IN_WATER;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'hippo', options, {
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

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        super.handleBehaviorEvent(event);

        if (this.meshes.length === 0) return;
        const mesh = this.meshes[0];

        if (event.type === 'IDLE_TICK') {
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, event.dt * 5);
            mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, event.dt * 5);
            // Sit lower in water
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, -0.5, event.dt * 2);
        } else if (event.type === 'PREPARING_TICK') {
            // Shake effect only, no tilt
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, event.dt * 10);

            // Smooth wobble instead of random shake
            const time = Date.now() / 50; // Speed of wobble
            const wobbleAmount = 0.05; // Amplitude
            mesh.rotation.z = Math.sin(time) * wobbleAmount;

            // Float up to 0.8
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.8, event.dt * 2);
        } else if (event.type === 'ACTIVE_TICK') {
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, event.dt * 10);
            mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, event.dt * 10);
            // Ensure at surface
            mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.8, event.dt * 5);
        }
    }
}
