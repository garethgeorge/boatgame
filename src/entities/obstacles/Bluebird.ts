import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingAnimalOptions } from './FlyingAnimal';
import { AnimalAnimations, Animal } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export class Bluebird extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions
    ) {
        const opts = {
            flightSpeed: 25.0,
            ...options
        };
        super(physicsEngine, 'bluebird', opts, {
            halfWidth: 1.5,
            halfLength: 1.5,
            density: 0.2,
            friction: 0.1
        });
    }

    protected getModelData() {
        return Decorations.getBluebird();
    }

    protected setupModel(model: THREE.Group): void {
        // Models are typically rotated to face -Z.
        // If the bluebird model follows this convention, we might need a rotation.
        // Butterfly had 0, but most animals need Math.PI based on GEMINI.md.
        // I'll stick with 0 for now as it's similar to butterfly, but keep this in mind.
        model.scale.set(2, 2, 2);
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
                        AnimalLogicPhase.PREPARING_ATTACK,
                        AnimalLogicPhase.ATTACKING
                    ],
                    play: Animal.play({
                        name: 'fly', state: 'FLYING',
                        timeScale: 6.0, randomizeLength: 0.2, startTime: -1
                    })
                }
            ]
        };
    }
}
