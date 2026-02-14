import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../Entity';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

import { EntityMetadata } from '../EntityMetadata';

export class BrownBear extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -2.0;
    public static readonly MODEL_PARAMS = { scale: 3.0, angle: Math.PI };
    public static readonly RADIUS: number = EntityMetadata.brownBear.radius;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'brownBear', Entity.TYPE_OBSTACLE, true,
            options,
            {
                hull: EntityMetadata.brownBear.hull,
                density: 5.0,
                friction: 0.3,
                linearDamping: 3.0,
                angularDamping: 2.0
            });

        this.setBehavior(AttackBehaviorFactory.create(this,
            {
                heightInWater: BrownBear.HEIGHT_IN_WATER,
                jumpsIntoWater: false,
                snoutOffset: 2.5,
                ...options,
            })
        );
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }

    protected getModelData() {
        return Decorations.getBrownBear();
    }

    protected setupModel(model: THREE.Group): void {
        const { scale, angle } = BrownBear.MODEL_PARAMS;
        model.scale.set(scale, scale, scale);
        if (angle !== undefined) model.rotation.y = angle;
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.play({
            name: 'Roaring',
            timeScale: 1.0, startTime: -1, randomizeLength: 0.2,
            repeat: Infinity
        }),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.ENTERING_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: Animal.play({
                    name: 'Roar+Walk',
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return BrownBear.animations;
    }
}
