import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackBehaviorFactory } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';

export class BrownBear extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -2.0;
    public static readonly RADIUS: number = 2.0;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'brownBear', Entity.TYPE_OBSTACLE, true,
            options,
            {
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

    protected getModelData() {
        return Decorations.getBrownBear();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AnimalAnimations = {
        default: AttackAnimal.play({
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
                play: AttackAnimal.play({
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
