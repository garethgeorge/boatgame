import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions, AttackBehaviorFactory } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';

export class Alligator extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -1.0;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'alligator', Entity.TYPE_OBSTACLE, true,
            options,
            {
                halfWidth: 1.0,
                halfLength: 3.0,
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

    protected getModelData() {
        return Decorations.getAlligator();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
        // faces along -z axis
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AnimalAnimations = {
        default: AttackAnimal.stop(),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.ENTERING_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: AttackAnimal.play({
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
