import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingAnimalOptions } from './FlyingAnimal';

export class Pterodactyl extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions
    ) {
        super(physicsEngine, 'pterodactyl', options, {
            halfWidth: 1.5,
            halfLength: 1.5,
            density: 1.0,
            friction: 0.1
        });
    }

    protected getModelData() {
        return Decorations.getPterodactyl();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
    }

    protected getIdleAnimationName(): string {
        return 'standing';
    }

    protected getFlightAnimationName(): string {
        return 'flying';
    }
}
