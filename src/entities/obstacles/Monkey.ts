import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimationStep } from '../../core/AnimationPlayer';

export class Monkey extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -1.7;
    public static readonly RADIUS: number = 2.0;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'monkey', Entity.TYPE_OBSTACLE, true,
            options,
            {
                density: 5.0,
                friction: 0.3,
                linearDamping: 3.0,
                angularDamping: 2.0
            });

        this.setBehavior(AttackBehaviorFactory.create(this,
            {
                heightInWater: Monkey.HEIGHT_IN_WATER,
                jumpsIntoWater: false,
                snoutOffset: 1.0,
                ...options,
            })
        );
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }

    protected getModelData() {
        return Decorations.getMonkey();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(0.025, 0.025, 0.025);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.play(
            AnimationStep.random(Infinity, [0.5, 0.5], [
                { name: 'idle', timeScale: 1.0, repeat: 2 },
                { name: 'dance', timeScale: 1.0, repeat: 2 },
            ])
        ),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.WALKING,
                    AnimalLogicPhase.ENTERING_WATER,
                ],
                play: Animal.play({
                    name: 'walk',
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
            {
                phases: [
                    AnimalLogicPhase.IDLE_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
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
        return Monkey.animations;
    }
}
