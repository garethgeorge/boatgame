import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class TRex extends AttackAnimal {

    protected get heightInWater(): number {
        return -3.0;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'trex', options, {
            halfWidth: 1.5,
            halfLength: 4.0,
            density: 10.0,
            friction: 0.1
        });
    }

    protected getModelData() {
        return Decorations.getTRex();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(6.0, 6.0, 6.0);
        model.rotation.y = Math.PI;
    }
}
