import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { Entity } from '../../core/Entity';

import { EntityMetadata } from '../EntityMetadata';

export class Turtle extends Animal {
    public static readonly HEIGHT_IN_WATER: number = -0.8;
    public static readonly MODEL_PARAMS = { scale: 2.0 };
    public static readonly RADIUS: number = EntityMetadata.turtle.radius;

    constructor(physicsEngine: PhysicsEngine, options: AnimalOptions) {
        super(
            physicsEngine,
            'turtle',
            Entity.TYPE_OBSTACLE,
            true,
            options,
            {
                hull: EntityMetadata.turtle.hull,
                density: 8.0,
                friction: 0.1,
                linearDamping: 1.0,
                angularDamping: 1.0
            });

        this.setBehavior(SwimAwayBehaviorFactory.create(
            this,
            {
                heightInWater: Turtle.HEIGHT_IN_WATER,
                ...options
            }
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }

    protected getModelData() {
        return Decorations.getTurtle();
    }

    protected setupModel(model: THREE.Group) {
        const scale = Turtle.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'idle',
                timeScale: 0.5,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.ENTERING_WATER, AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'swim',
                        timeScale: 1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
