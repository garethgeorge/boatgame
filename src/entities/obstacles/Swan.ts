import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { SwimAwayAnimal } from './SwimAwayAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal } from './Animal';

export class Swan extends SwimAwayAnimal {

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super(
            physicsEngine,
            'swan',
            Entity.TYPE_OBSTACLE,
            { x, y, height: 0.2, angle },
            { halfWidth: 1.5, halfLength: 3.0 }
        );
    }

    protected getModelData() {
        return Decorations.getSwan();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(3, 3, 3);
        //model.rotation.y = Math.PI;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'idle', state: 'IDLE',
                timeScale: 1.0, randomizeLength: 0.1, startTime: -1.0
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'swim', state: 'SWIMING_AWAY',
                        timeScale: 1.5, randomizeLength: 0.1, startTime: -1.0
                    })
                }
            ]
        };
    }
}
