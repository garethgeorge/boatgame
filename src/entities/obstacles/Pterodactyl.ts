import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingAnimalOptions, FlyingLogicOrchestrator } from './FlyingAnimal';
import { AnimalAnimations, Animal } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';

export class Pterodactyl extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions
    ) {
        const opts = {
            flightSpeed: 30.0,
            ...options
        };
        super(physicsEngine, 'pterodactyl', Entity.TYPE_OBSTACLE, false,
            opts,
            {
                halfWidth: 1.5,
                halfLength: 1.5,
                density: 1.0,
                friction: 0.1
            },
            new FlyingLogicOrchestrator({ flightSpeed: opts.flightSpeed })
        );
    }

    protected getModelData() {
        return Decorations.getPterodactyl();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'standing',
                timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                    ],
                    play: Animal.play({
                        name: 'flying',
                        timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
