import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { EntityMetadata } from '../EntityMetadata';

export class Duckling extends Animal {
    public static readonly HEIGHT_IN_WATER: number = 0.0;
    public static readonly MODEL_PARAMS = { scale: 1.0, angle: Math.PI };
    public static readonly RADIUS: number = EntityMetadata.duckling.radius;

    constructor(physicsEngine: PhysicsEngine, options: AnimalOptions) {
        super(
            physicsEngine,
            'duckling',
            Entity.TYPE_COLLECTABLE,
            false,
            { height: 0.5, ...options },
            {
                hull: EntityMetadata.duckling.hull
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
        return Decorations.getDuckling();
    }

    protected setupModel(model: THREE.Group) {
        const { scale, angle } = Duckling.MODEL_PARAMS;
        model.scale.set(scale, scale, scale);
        model.rotation.y = angle;
        model.position.y = -0.75;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'bob',
                timeScale: 2.0, randomizeLength: 0.2, startTime: -1.0,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'bob',
                        timeScale: 3.0, randomizeLength: 0.2, startTime: -1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
