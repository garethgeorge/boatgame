import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimationStep } from '../../core/AnimationPlayer';

import { EntityMetadata } from '../EntityMetadata';

export class Swan extends Animal {
    public static readonly HEIGHT_IN_WATER: number = 0.0;
    public static readonly MODEL_PARAMS = { scale: 3.0 };
    public static readonly RADIUS: number = EntityMetadata.swan.radius;

    constructor(physicsEngine: PhysicsEngine, options: AnimalOptions) {
        super(
            physicsEngine,
            'swan',
            Entity.TYPE_OBSTACLE,
            false,
            { height: 0.2, ...options },
            {
                hull: EntityMetadata.swan.hull
            });

        this.setBehavior(SwimAwayBehaviorFactory.create(
            this,
            options
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }

    protected getModelData() {
        return Decorations.getSwan();
    }

    protected setupModel(model: THREE.Group) {
        const scale = Swan.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
        //model.rotation.y = Math.PI;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play(
                AnimationStep.random(Infinity, [0.7, 0.3], [
                    {
                        name: 'bob',
                        timeScale: 0.5, randomizeLength: 0.0, startTime: 0,
                        repeat: 3
                    },
                    {
                        name: 'idle',
                        timeScale: 1.0, randomizeLength: 0.0, startTime: 0,
                        repeat: 1
                    },
                ])
            ),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'swim',
                        timeScale: 1.5, randomizeLength: 0.1, startTime: -1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
