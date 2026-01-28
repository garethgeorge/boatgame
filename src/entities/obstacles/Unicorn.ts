import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ShoreAnimal, ShoreAnimalOptions, ShoreAnimalBehaviorFactory } from './ShoreAnimal';
import { AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { AnimationStep } from '../../core/AnimationPlayer';

export class Unicorn extends ShoreAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: ShoreAnimalOptions
    ) {
        super(physicsEngine, 'unicorn', Entity.TYPE_OBSTACLE, true,
            options,
            {
                density: 5.0,
                friction: 0.3,
                linearDamping: 3.0,
                angularDamping: 2.0
            });

        this.setBehavior(ShoreAnimalBehaviorFactory.create(this, {
            ...options
        }));
    }

    protected getModelData() {
        return Decorations.getUnicorn();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(6, 6, 6);
    }

    private static readonly animations: AnimalAnimations = {
        default: Unicorn.play(
            AnimationStep.random(Infinity, [0.5, 0.25, 0.25], [
                { name: 'stand', timeScale: 0.2, repeat: 1 },
                { name: 'paw', timeScale: 0.5, repeat: 1 },
                { name: 'rear', timeScale: 0.5, repeat: 1 },
            ])
        )
    }

    protected getAnimations(): AnimalAnimations {
        return Unicorn.animations;
    }
}
