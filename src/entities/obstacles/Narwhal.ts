import * as THREE from 'three';
import { Entity } from '../Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { EntityMetadata } from '../EntityMetadata';

export class Narwhal extends Animal {
    public static readonly HEIGHT_IN_WATER: number = 0.0;
    public static readonly MODEL_PARAMS = { scale: 3.5 };
    public static readonly RADIUS: number = EntityMetadata.narwhal.radius;

    constructor(physicsEngine: PhysicsEngine, options: AnimalOptions) {
        super(
            physicsEngine,
            'narwhal',
            Entity.TYPE_OBSTACLE,
            false,
            { height: 0.2, ...options },
            {
                hull: EntityMetadata.narwhal.hull
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
        return Decorations.getNarwhal();
    }

    protected setupModel(model: THREE.Group) {
        const scale = Narwhal.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'idle',
                timeScale: 0.25, randomizeLength: 0.1, startTime: -1.0,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'swim',
                        timeScale: 0.5, randomizeLength: 0.1, startTime: -1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
