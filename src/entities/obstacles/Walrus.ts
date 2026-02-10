import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

import { EntityMetadata } from '../EntityMetadata';

export class Walrus extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -1.5;
    public static readonly MODEL_PARAMS = { scale: 3.0, angle: Math.PI };
    public static readonly RADIUS: number = EntityMetadata.walrus.radius;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'walrus', Entity.TYPE_OBSTACLE, true,
            options,
            {
                hull: EntityMetadata.walrus.hull,
                density: 6.0,
                friction: 0.3,
                linearDamping: 3.0,
                angularDamping: 2.0
            });

        this.setBehavior(AttackBehaviorFactory.create(this,
            {
                heightInWater: Walrus.HEIGHT_IN_WATER,
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
        return Decorations.getWalrus();
    }

    protected setupModel(model: THREE.Group): void {
        const { scale, angle } = Walrus.MODEL_PARAMS;
        model.scale.set(scale, scale, scale);
        model.rotation.y = angle;
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.play({
            name: 'idle',
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
                    name: 'walk',
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return Walrus.animations;
    }
}
