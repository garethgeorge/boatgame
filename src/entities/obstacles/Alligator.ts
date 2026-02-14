import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../Entity';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Decorations } from '../../world/decorations/Decorations';

import { EntityMetadata } from '../EntityMetadata';

export class Alligator extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -1.0;
    public static readonly MODEL_PARAMS = { scale: 3.0, angle: Math.PI };
    public static readonly RADIUS: number = EntityMetadata.alligator.radius;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'alligator', Entity.TYPE_OBSTACLE, true,
            options,
            {
                hull: EntityMetadata.alligator.hull,
                density: 5.0,
                friction: 0.1,
                linearDamping: 2.0,
                angularDamping: 1.0
            });

        this.setBehavior(
            AttackBehaviorFactory.create(this, {
                heightInWater: Alligator.HEIGHT_IN_WATER,
                jumpsIntoWater: false,
                snoutOffset: 3.0,
                ...options,
            })
        );
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }

    protected getModelData() {
        return Decorations.getAlligator();
    }

    protected setupModel(model: THREE.Group): void {
        const { scale, angle } = Alligator.MODEL_PARAMS;
        model.scale.set(scale, scale, scale);
        model.rotation.y = angle;
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.stop(),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.ENTERING_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: Animal.play({
                    name: 'walking',
                    timeScale: 2.0, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return Alligator.animations;
    }

}
