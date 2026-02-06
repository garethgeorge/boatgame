import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';
import { FlyingBehaviorFactory } from '../behaviors/FlyingBehaviorFactory';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';

import { EntityMetadata } from '../EntityMetadata';

export class Bluebird extends Animal {
    public static readonly MODEL_PARAMS = { scale: 2.0 };
    public static readonly RADIUS: number = EntityMetadata.bluebird.radius;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'bluebird', Entity.TYPE_OBSTACLE, false,
            options,
            {
                hull: EntityMetadata.bluebird.hull,
                density: 0.2,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createShoreLanding(
            this,
            {
                noticeDistance: 100.0,
                flightSpeed: 25.0,
                ...options,
            }
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }

    protected getModelData() {
        return Decorations.getBluebird();
    }

    protected setupModel(model: THREE.Group): void {
        const scale = Bluebird.MODEL_PARAMS.scale;
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
                        AnimalLogicPhase.PREPARING_ATTACK,
                        AnimalLogicPhase.ATTACKING
                    ],
                    play: Animal.play({
                        name: 'fly',
                        timeScale: 6.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
