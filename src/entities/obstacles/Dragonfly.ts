import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingBehaviorFactory } from './FlyingAnimal';
import { AnimalAnimations, Animal, AnimalOptions } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';

export class Dragonfly extends FlyingAnimal {
    public static readonly RADIUS: number = 1.5;


    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'dragonfly', Entity.TYPE_OBSTACLE, false,
            options,
            {
                density: 0.1,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createWandering(
            this,
            {
                noticeDistance: 60.0,
                flightSpeed: 40.0,
                flightHeight: 4.0,
                buzzDuration: 2.0,
                buzzHeight: 1.5,
                buzzOffset: 3.0,
                wanderRadius: 10.0,
                ...options,
            }
        ));
    }

    protected getModelData() {
        return Decorations.getDragonfly();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(2.25, 2.25, 2.25);
        // Dragonflies usually have their front at -Z in models, 
        // but if it's flipped we might need Math.PI.
        model.rotation.y = 0;
    }

    protected getAnimations(): AnimalAnimations {
        return {
            default: Animal.play({
                name: 'flying',
                timeScale: 4.0, randomizeLength: 0.2, startTime: -1,
                repeat: Infinity
            })
        };
    }
}
