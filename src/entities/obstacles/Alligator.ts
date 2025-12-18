import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class Alligator extends AttackAnimal {

    protected get heightInWater(): number {
        return -1.0;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'alligator', options, {
            halfWidth: 1.0,
            halfLength: 3.0,
            density: 5.0,
            friction: 0.1,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
    }

    protected getModelData() {
        return Decorations.getAlligator();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
    }

    protected getAnimationTimeScale(): number {
        return 2.0;
    }

}
