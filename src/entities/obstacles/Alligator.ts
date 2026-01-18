import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalAnimations, AttackAnimalOptions } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export class Alligator extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -1.0;

    protected get heightInWater(): number {
        return Alligator.HEIGHT_IN_WATER;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'alligator', options, {
            halfWidth: 1.0,
            halfLength: 3.0,
            density: 5.0,
            friction: 0.1,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
    }

    protected getModelData() {
        return Decorations.getAlligator();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AttackAnimalAnimations = {
        default: AttackAnimal.play({
            name: 'standing', state: 'idle',
            timeScale: 2.0, startTime: -1, randomizeLength: 0.2
        }),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.ENTERING_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: AttackAnimal.play({
                    name: 'walking', state: 'walking',
                    timeScale: 2.0, startTime: -1, randomizeLength: 0.2
                })
            },
        ]
    }

    protected getAnimations(): AttackAnimalAnimations {
        return Alligator.animations;
    }

}
