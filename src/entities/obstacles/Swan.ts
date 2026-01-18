import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { SwimAwayAnimal, SwimmerAnimationConfig } from './SwimAwayAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export class Swan extends SwimAwayAnimal {

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super(
            physicsEngine,
            'swan',
            Entity.TYPE_OBSTACLE,
            { x, y, height: 0.2, angle },
            { halfWidth: 1.5, halfLength: 3.0 }
        );
    }

    protected getModelData() {
        return Decorations.getSwan();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(3, 3, 3);
        //model.rotation.y = Math.PI;
    }

    protected getAnimationConfig(state: AnimalLogicPhase): SwimmerAnimationConfig {
        const isFleeing = state === AnimalLogicPhase.FLEEING;
        return {
            name: isFleeing ? 'swim' : 'idle',
            timeScale: isFleeing ? 1.5 : 1.0,
            randomizeLength: 0.1,
            startTime: -1.0
        };
    }
}
