import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimationPlayer } from '../../core/AnimationPlayer';

import { EntityMetadata } from '../EntityMetadata';

export class Snake extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -0.5;
    public static readonly MODEL_SCALE: number = 3.0;
    public static readonly RADIUS: number = EntityMetadata.snake.radius;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'snake', Entity.TYPE_OBSTACLE, true,
            options,
            {
                density: 3.0,
                friction: 0.1,
                linearDamping: 2.0,
                angularDamping: 1.0
            });

        this.setBehavior(
            AttackBehaviorFactory.create(this, {
                heightInWater: Snake.HEIGHT_IN_WATER,
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
        return Decorations.getSnake();
    }

    protected setupModel(model: THREE.Group): void {
        const scale = Snake.MODEL_SCALE;
        model.scale.set(scale, scale, scale);
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.play((step: number) => {
            // always play first time through to establish pose
            const r = Math.random();
            if (step === 0 || r < 0.5) {
                return {
                    name: 'idle', repeat: 1, timeScale: 0.5
                }
            };
            return { name: AnimationPlayer.NONE, duration: 2.0 };
        }),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: Animal.play({
                    name: 'swim', timeScale: 1.0, repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return Snake.animations;
    }

}
