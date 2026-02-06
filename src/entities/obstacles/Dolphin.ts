import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory'; // Added this import
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { EntityMetadata } from '../EntityMetadata';

export class Dolphin extends Animal {
    public static readonly HEIGHT_IN_WATER: number = 0.0;
    public static readonly MODEL_PARAMS = { scale: 4.0 };
    public static readonly RADIUS: number = EntityMetadata.dolphin.radius;

    constructor(physicsEngine: PhysicsEngine, options: AnimalOptions) {
        super(
            physicsEngine,
            'dolphin',
            Entity.TYPE_OBSTACLE,
            false,
            { height: 0.2, ...options },
            {
                hull: EntityMetadata.dolphin.hull
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
        return Decorations.getDolphin();
    }

    protected setupModel(model: THREE.Group) {
        const scale = Dolphin.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'idle',
                timeScale: 1.0, randomizeLength: 0.1, startTime: -1.0,
                repeat: Infinity
            }),
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
