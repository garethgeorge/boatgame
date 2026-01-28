import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { ShoreBehaviorFactory } from '../behaviors/ShoreBehaviorFactory';
import { AnimationStep } from '../../core/AnimationPlayer';

export class Unicorn extends Animal {
    public static readonly RADIUS: number = 3.0;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'unicorn', Entity.TYPE_OBSTACLE, true,
            options,
            {
                density: 5.0,
                friction: 0.3,
                linearDamping: 3.0,
                angularDamping: 2.0
            });

        this.setBehavior(ShoreBehaviorFactory.create(this, {
            ...options
        }));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }

    protected getModelData() {
        return Decorations.getUnicorn();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(6, 6, 6);
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.play(
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
