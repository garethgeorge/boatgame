import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { SwimAwayAnimal, SwimAwayLogicOrchestrator, SwimAwayAnimalOptions } from './SwimAwayAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal } from './Animal';

export class Duckling extends SwimAwayAnimal {

    constructor(physicsEngine: PhysicsEngine, options: SwimAwayAnimalOptions) {
        super(
            physicsEngine,
            'duckling',
            Entity.TYPE_COLLECTABLE,
            false,
            { height: 0.5, ...options },
            { halfWidth: 1.5, halfLength: 3.0 },
            new SwimAwayLogicOrchestrator()
        );
    }

    protected getModelData() {
        return Decorations.getDuckling();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(1.0, 1.0, 1.0);
        model.rotation.y = Math.PI;
        model.position.y = -1.25;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'bob', state: 'IDLE',
                timeScale: 2.0, randomizeLength: 0.2, startTime: -1.0
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'bob', state: 'SWIMING_AWAY',
                        timeScale: 3.0, randomizeLength: 0.2, startTime: -1.0
                    })
                }
            ]
        };
    }
}
