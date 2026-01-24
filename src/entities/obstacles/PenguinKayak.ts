import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { SwimAwayAnimal, SwimAwayAnimalOptions, SwimAwayBehaviorFactory } from './SwimAwayAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations, Animal } from './Animal';

export class PenguinKayak extends SwimAwayAnimal {
    public static readonly HEIGHT_IN_WATER: number = 0.5;

    constructor(physicsEngine: PhysicsEngine, options: SwimAwayAnimalOptions) {
        super(
            physicsEngine,
            'penguinKayak',
            Entity.TYPE_OBSTACLE,
            false,
            { height: 0.5, ...options },
            {});

        this.setBehavior(SwimAwayBehaviorFactory.create(
            this,
            options
        ));
    }

    protected getModelData() {
        return Decorations.getPenguinKayak();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(2.0, 2.0, 2.0);
        model.rotation.y = Math.PI / 2.0;
        model.position.y = -0.4;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'paddling',
                timeScale: 2.0, randomizeLength: 0.2, startTime: -1.0,
                repeat: Infinity
            }),
            animations: [
                {
                    phases: [AnimalLogicPhase.SWIMING_AWAY],
                    play: Animal.play({
                        name: 'paddling',
                        timeScale: 3.5, randomizeLength: 0.2, startTime: -1.0,
                        repeat: Infinity
                    })
                }
            ]
        };
    }

    protected override getHitBehaviorParams() {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
