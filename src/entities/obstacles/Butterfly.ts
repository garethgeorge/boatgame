import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { FlyingAnimal, FlyingAnimalOptions, AnimationConfig } from './FlyingAnimal';

export class Butterfly extends FlyingAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions
    ) {
        const opts = {
            flightSpeed: 20.0,
            ...options
        };
        super(physicsEngine, 'butterfly', opts, {
            halfWidth: 1.0,
            halfLength: 1.0,
            density: 0.1,
            friction: 0.1
        });
    }

    protected getModelData() {
        return Decorations.getButterfly();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(1, 1, 1);
        model.rotation.y = 0;
    }

    protected getIdleAnimationName(): AnimationConfig {
        return { name: 'idle', timeScale: 1.0 };
    }

    protected getFlightAnimationName(): AnimationConfig {
        return { name: 'fly', timeScale: 10.0 };
    }
}
