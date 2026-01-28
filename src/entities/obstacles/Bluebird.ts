import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingBehaviorFactory } from './FlyingAnimal';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';

export class Bluebird extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'bluebird', Entity.TYPE_OBSTACLE, false,
            options,
            {
                density: 0.2,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createShoreLanding(
            this,
            {
                noticeDistance: 100.0,
                flightSpeed: 25.0,
                ...options,
            }
        ));
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
                name: 'idle',
                timeScale: 1.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [
                        AnimalLogicPhase.FLYING,
                        AnimalLogicPhase.PREPARING_ATTACK,
                        AnimalLogicPhase.ATTACKING
                    ],
                    play: Animal.play({
                        name: 'fly',
                        timeScale: 6.0, randomizeLength: 0.2, startTime: -1,
                        repeat: Infinity
                    })
                }
            ]
        };
    }
}
