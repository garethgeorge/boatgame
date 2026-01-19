import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingAnimalOptions, FlyingBehaviorFactory } from './FlyingAnimal';
import { AnimalAnimations, Animal } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';

export class Butterfly extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions
    ) {
        super(physicsEngine, 'butterfly', Entity.TYPE_OBSTACLE, false,
            options,
            {
                halfWidth: 1.0,
                halfLength: 1.0,
                density: 0.1,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.create(
            this,
            {
                flightSpeed: 20.0,
                ...options,
            }
        ));
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
                name: 'idle',
                timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                    ],
                    play: Animal.play({
                        name: 'fly',
                        timeScale: 10.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
