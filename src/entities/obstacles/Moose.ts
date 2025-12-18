import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';

export class Moose extends AttackAnimal {

    protected get heightInWater(): number {
        return -3.0;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'moose', options, {
            halfWidth: 1.5,
            halfLength: 2.5,
            density: 5.0,
            friction: 0.3,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
    }

    protected getModelData() {
        return Decorations.getMoose();
    }

    protected setupModel(model: THREE.Group): void {
        model.position.y = 3.0;
        model.scale.set(0.1, 0.1, 0.1);
        model.rotation.y = Math.PI;
    }

    protected getIdleAnimationName(): string {
        return 'idle';
    }

    protected getWalkingAnimationName(): string {
        return 'walk';
    }

    setLandPosition(height: number, normal: THREE.Vector3, progress: number): void {
        if (this.meshes.length > 0) {
            const t = Math.max(0, Math.min(progress, 1));
            const curve = 4 * t * (1.0 - t);
            const jumpHeight = 2.0 * curve;
            this.meshes[0].position.y = height + jumpHeight;
        }
        this.normalVector.copy(normal);
    }

    protected playWalkingAnimation(duration: number): void {
        if (!this.player) {
            return;
        }

        if (duration > 0.5) {
            const startTimeScale = 0.5;
            const endTimeScale = 0.5;
            const fallDuration = duration - startTimeScale - endTimeScale;

            this.player.playSequence([
                { name: 'jump_start', duration: startTimeScale },
                { name: 'jump_fall', duration: fallDuration },
                { name: 'jump_end', duration: endTimeScale }
            ]);
        } else {
            this.player.play({ name: 'walk', startTime: -1 });
        }
    }

    enteringWaterDidComplete(speed: number) {
        super.enteringWaterDidComplete(speed);

        if (this.meshes.length > 0) {
            this.meshes[0].position.y = this.heightInWater;
        }
        this.normalVector.set(0, 1, 0);
    }
}
