import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';
import { AnimalLogic, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimationPlayer, AnimationStep } from '../../core/AnimationPlayer';

import { EntityMetadata } from '../EntityMetadata';

export class Moose extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -3.0;
    public static readonly MODEL_SCALE: number = 0.1;
    public static readonly RADIUS: number = EntityMetadata.moose.radius;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'moose', Entity.TYPE_OBSTACLE, true,
            options,
            {
                density: 5.0,
                friction: 0.3,
                linearDamping: 3.0,
                angularDamping: 2.0
            });

        this.setBehavior(AttackBehaviorFactory.create(this,
            {
                heightInWater: Moose.HEIGHT_IN_WATER,
                jumpsIntoWater: true,
                snoutOffset: 2.5,
                ...options,
            })
        );
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }

    protected getModelData() {
        return Decorations.getMoose();
    }

    protected setupModel(model: THREE.Group): void {
        model.position.y = 3.0;
        const scale = Moose.MODEL_SCALE;
        model.scale.set(scale, scale, scale);
        model.rotation.y = Math.PI;
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
                ],
                play: Animal.playForDuration((duration: number) => {
                    if (duration > 0.5) {
                        const startTimeScale = 0.5;
                        const endTimeScale = 0.5;
                        const fallDuration = duration - startTimeScale - endTimeScale;

                        return AnimationStep.sequence([
                            { name: 'jump_start', duration: startTimeScale },
                            { name: 'jump_fall', duration: fallDuration },
                            { name: 'jump_end', duration: endTimeScale }
                        ]);
                    } else {
                        return { name: 'walk', startTime: -1 };
                    }
                })
            },
            {
                phases: [
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
        return Moose.animations;
    }
}
