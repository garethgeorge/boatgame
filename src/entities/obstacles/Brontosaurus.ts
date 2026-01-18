import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations } from './Animal';

export class Brontosaurus extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -1.5;

    protected get heightInWater(): number {
        return Brontosaurus.HEIGHT_IN_WATER;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'brontosaurus', options, {
            halfWidth: 1.5,
            halfLength: 2.5,
            density: 5.0,
            friction: 0.3,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
    }

    protected getModelData() {
        return Decorations.getBrontosaurus();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(8.0, 8.0, 8.0);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AnimalAnimations = {
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

    protected getAnimations(): AnimalAnimations {
        return Brontosaurus.animations;
    }
}
