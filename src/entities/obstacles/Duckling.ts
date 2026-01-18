import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { SwimAwayAnimal, SwimmerAnimationConfig } from './SwimAwayAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export class Duckling extends SwimAwayAnimal {

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super(
            physicsEngine,
            'duckling',
            Entity.TYPE_COLLECTABLE,
            { x, y, height: 0.5, angle },
            { halfWidth: 1.5, halfLength: 3.0 }
        );
    }

    protected getModelData() {
        return Decorations.getDuckling();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(1.0, 1.0, 1.0);
        model.rotation.y = Math.PI;
        model.position.y = -1.25;
    }

    protected getAnimationConfig(state: AnimalLogicPhase): SwimmerAnimationConfig {
        const timeScale = state === AnimalLogicPhase.FLEEING ? 3.0 : 2.0;
        return {
            name: 'bob',
            timeScale: timeScale,
            randomizeLength: 0.2,
            startTime: -1.0
        };
    }
}
