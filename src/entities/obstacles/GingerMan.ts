import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { SwimAwayBehaviorFactory } from '../behaviors/SwimAwayBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimationStep } from '../../core/AnimationPlayer';

import { EntityMetadata } from '../EntityMetadata';

/**
 * GingerMan Animal: Same behavior as Monkey but with a gingerbread man model.
 * Animations: lookaround, wave, strut, swim.
 */
export class GingerMan extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -4;
    public static readonly MODEL_PARAMS = { scale: 6, angle: Math.PI };
    public static readonly RADIUS: number = EntityMetadata.gingerman.radius;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'gingerman', Entity.TYPE_OBSTACLE, true,
            options,
            {
                hull: EntityMetadata.gingerman.hull,
                density: 5.0,
                friction: 0.3,
                linearDamping: 3.0,
                angularDamping: 2.0
            });

        this.setBehavior(SwimAwayBehaviorFactory.create(this,
            {
                heightInWater: GingerMan.HEIGHT_IN_WATER,
                jumpsIntoWater: false,
                ...options,
                behavior: options.behavior ?? { type: 'walk-swim' }
            })
        );
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -10 };
    }

    protected getModelData() {
        return Decorations.getGingerMan();
    }

    protected setupModel(model: THREE.Group): void {
        const { scale, angle } = GingerMan.MODEL_PARAMS;
        model.scale.set(scale, scale, scale);
        model.rotation.y = angle;
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.play(
            AnimationStep.random(Infinity, [0.33, 0.33, 0.34], [
                { name: 'lookaround', timeScale: 1.0, repeat: 1 },
                { name: 'wave', timeScale: 1.0, repeat: 1 },
                null, // No animation
            ])
        ),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.WALKING,
                    AnimalLogicPhase.ENTERING_WATER,
                ],
                play: Animal.play({
                    name: 'strut',
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
            {
                phases: [
                    AnimalLogicPhase.IDLE_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                    AnimalLogicPhase.SWIMING_AWAY,
                ],
                play: Animal.play({
                    name: 'swim',
                    timeScale: 2.5, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return GingerMan.animations;
    }
}
