import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalAnimations, AttackAnimalOptions } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export class Triceratops extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -1.5;

    protected get heightInWater(): number {
        return Triceratops.HEIGHT_IN_WATER;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'triceratops', options, {
            halfWidth: 1.5,
            halfLength: 2.5,
            density: 5.0,
            friction: 0.3,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
    }

    protected getModelData() {
        return Decorations.getTriceratops();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AttackAnimalAnimations = {
        default: AttackAnimal.play({
            name: 'standing', state: 'idle',
            timeScale: 0.5, startTime: -1, randomizeLength: 0.2
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
                    timeScale: 0.5, startTime: -1, randomizeLength: 0.2
                })
            },
        ]
    }

    protected getAnimations(): AttackAnimalAnimations {
        return Triceratops.animations;
    }
}
