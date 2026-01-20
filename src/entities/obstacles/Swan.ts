import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { SwimAwayAnimal, SwimAwayAnimalOptions, SwimAwayBehaviorFactory } from './SwimAwayAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal } from './Animal';
import { AnimationStep } from '../../core/AnimationPlayer';

export class Swan extends SwimAwayAnimal {

    constructor(physicsEngine: PhysicsEngine, options: SwimAwayAnimalOptions) {
        super(
            physicsEngine,
            'swan',
            Entity.TYPE_OBSTACLE,
            false,
            { height: 0.2, ...options },
            { halfWidth: 1.5, halfLength: 3.0 });

        this.setBehavior(SwimAwayBehaviorFactory.create(
            this,
            options
        ));
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
            default: Animal.play(
                AnimationStep.random(Infinity, [0.7, 0.3], [
                    {
                        name: 'bob',
                        timeScale: 0.5, randomizeLength: 0.0, startTime: 0,
                        repeat: 3
                    },
                    {
                        name: 'idle',
                        timeScale: 1.0, randomizeLength: 0.0, startTime: 0,
                        repeat: 1
                    },
                ])
            ),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'swim',
                        timeScale: 1.5, randomizeLength: 0.1, startTime: -1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
