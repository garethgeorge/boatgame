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

export class Pterodactyl extends Animal {
    public static readonly MODEL_PARAMS = { scale: 3.0 };
    public static readonly RADIUS: number = EntityMetadata.pterodactyl.radius;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'pterodactyl', Entity.TYPE_OBSTACLE, false,
            options,
            {
                hull: EntityMetadata.pterodactyl.hull,
                density: 1.0,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createShoreLanding(
            this,
            {
                noticeDistance: 200.0,
                flightSpeed: 30.0,
                ...options,
            }
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }

    protected getModelData() {
        return Decorations.getPterodactyl();
    }

    protected setupModel(model: THREE.Group): void {
        const scale = Pterodactyl.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'standing',
                timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                    ],
                    play: Animal.play({
                        name: 'flying',
                        timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
