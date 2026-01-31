import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';
import { FlyingBehaviorFactory } from '../behaviors/FlyingBehaviorFactory';
import { AnimationPlayer, AnimationStep } from '../../core/AnimationPlayer';

import { EntityMetadata } from '../EntityMetadata';

export class Egret extends Animal {
    public static readonly HEIGHT_IN_WATER = -0.2;
    public static readonly MODEL_PARAMS = { scale: 3.0 };
    public static readonly RADIUS: number = EntityMetadata.egret.radius;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'egret', Entity.TYPE_OBSTACLE, false,
            options,
            {
                density: 1.0,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createWaterLanding(
            this,
            {
                noticeDistance: 20.0,
                flightSpeed: 25.0,
                landingHeight: Egret.HEIGHT_IN_WATER,
                ...options,
            }
        ));
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }

    protected getModelData() {
        return Decorations.getEgret();
    }

    protected setupModel(model: THREE.Group): void {
        const scale = Egret.MODEL_PARAMS.scale;
        model.scale.set(scale, scale, scale);
        //model.position.y = -0.2;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play(
                AnimationStep.sequence([
                    // must play something first to establish pose
                    { name: 'idle-1', repeat: 1, timeScale: 2 },
                    // then randomly pick something
                    AnimationStep.random(Infinity, [0.3, 0.3, 0.2, 0.2], [
                        { name: AnimationPlayer.NONE, duration: 2.0 },
                        { name: 'idle-1', repeat: 1, timeScale: 2 },
                        { name: 'idle-2', repeat: 1 },
                        { name: 'dip-raise', repeat: 1 },
                    ])
                ])
            ),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                    ],
                    play: Animal.play({
                        name: 'flying',
                        timeScale: 3.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
