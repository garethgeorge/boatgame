import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingAnimalOptions, FlyingLogicOrchestrator } from './FlyingAnimal';
import { AnimalAnimations, Animal } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export class Butterfly extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions
    ) {
        const opts = {
            flightSpeed: 20.0,
            ...options
        };
        super(physicsEngine, 'butterfly', opts, {
            halfWidth: 1.0,
            halfLength: 1.0,
            density: 0.1,
            friction: 0.1
        }, new FlyingLogicOrchestrator({ flightSpeed: opts.flightSpeed }));
    }

    protected getModelData() {
        return Decorations.getButterfly();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(1, 1, 1);
        model.rotation.y = 0;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'idle', state: 'IDLE',
                timeScale: 1.0, randomizeLength: 0.2, startTime: -1
            }),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                    ],
                    play: Animal.play({
                        name: 'fly', state: 'FLYING',
                        timeScale: 10.0, randomizeLength: 0.2, startTime: -1
                    })
                }
            ]
        };
    }
}
