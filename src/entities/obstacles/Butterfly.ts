import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../Entity';
import { FlyingBehaviorFactory } from '../behaviors/FlyingBehaviorFactory';

import { EntityMetadata } from '../EntityMetadata';
import { FlyingBehaviorConfig } from '../behaviors/AnimalBehaviorConfigs';

export class Butterfly extends Animal {
    public static readonly MODEL_PARAMS = { scale: 1.0 };
    public static readonly RADIUS: number = EntityMetadata.butterfly.radius;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'butterfly', Entity.TYPE_OBSTACLE, false,
            options,
            {
                hull: EntityMetadata.butterfly.hull,
                density: 0.1,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.create(
            this,
            options.behavior as FlyingBehaviorConfig,
            options
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }

    protected getModelData() {
        return Decorations.getButterfly();
    }

    protected setupModel(model: THREE.Group): void {
        const scale = Butterfly.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
        model.rotation.y = 0;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'idle',
                timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                    ],
                    play: Animal.play({
                        name: 'fly',
                        timeScale: 10.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
