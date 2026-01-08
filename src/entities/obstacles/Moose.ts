import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class Moose extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -3.0;

    protected get heightInWater(): number {
        return Moose.HEIGHT_IN_WATER;
    }

    protected get jumpsIntoWater(): boolean {
        return true;
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
}
