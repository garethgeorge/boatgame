import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class Brontosaurus extends AttackAnimal {

    protected getTargetWaterHeight(): number {
        return -1.5;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'brontosaurus', options, {
            halfWidth: 1.5,
            halfLength: 2.5,
            density: 5.0,
            friction: 0.3,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
    }

    protected getModelData() {
        return Decorations.getBrontosaurus();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(8.0, 8.0, 8.0);
        model.rotation.y = Math.PI;
    }

    protected getAnimationTimeScale(): number {
        return 0.5;
    }
}
