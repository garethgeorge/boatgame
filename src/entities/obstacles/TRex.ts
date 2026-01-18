import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions, AttackLogicOrchestrator } from './AttackAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations } from './Animal';

export class TRex extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -3.0;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'trex', options,
            {
                halfWidth: 1.5,
                halfLength: 4.0,
                density: 10.0,
                friction: 0.1
            },
            new AttackLogicOrchestrator({
                attackLogicName: options.attackLogicName,
                heightInWater: TRex.HEIGHT_IN_WATER,
                onShore: options.onShore,
                stayOnShore: options.stayOnShore
            })
        );
    }

    protected getModelData() {
        return Decorations.getTRex();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(6.0, 6.0, 6.0);
        model.rotation.y = Math.PI;
    }

    private static readonly animations: AnimalAnimations = {
        default: AttackAnimal.play({
            name: 'standing', state: 'idle',
            timeScale: 1.0, startTime: -1, randomizeLength: 0.2
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
                    timeScale: 1.0, startTime: -1, randomizeLength: 0.2
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return TRex.animations;
    }
}
