import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions, AttackBehaviorFactory } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { AnimationPlayer } from '../../core/AnimationPlayer';

export class Snake extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -0.5;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
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

    protected getModelData() {
        return Decorations.getSnake();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
    }

    private static readonly animations: AnimalAnimations = {
        default: AttackAnimal.play((step: number) => {
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
                play: AttackAnimal.play({
                    name: 'swim', timeScale: 1.0, repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return Snake.animations;
    }

}
