import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingAnimalOptions, FlyingBehaviorFactory } from './FlyingAnimal';
import { AnimalAnimations, Animal } from './Animal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Entity } from '../../core/Entity';

export class Dragonfly extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions
    ) {
        super(physicsEngine, 'dragonfly', Entity.TYPE_OBSTACLE, false,
            options,
            {
                halfWidth: 0.75,
                halfLength: 1.5,
                density: 0.1,
                friction: 0.1
            });

        this.setBehavior(FlyingBehaviorFactory.createWandering(
            this,
            {
                flightSpeed: 40.0,
                noticeDistance: 60.0,
                buzzDuration: 2.0,
                buzzHeight: 1.5,
                buzzOffset: 3.0,
                maxHeight: 5.0,
                wanderRadius: 10.0,
                turningSpeed: Math.PI * 4.0,
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
