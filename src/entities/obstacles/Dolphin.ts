import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { SwimAwayAnimal, SwimmerAnimationConfig } from './SwimAwayAnimal';

export class Dolphin extends SwimAwayAnimal {

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super(
            physicsEngine,
            'dolphin',
            Entity.TYPE_OBSTACLE,
            { x, y, height: 0.2, angle },
            { halfWidth: 1.5, halfLength: 4.0 }
        );
    }

    protected getModelData() {
        return Decorations.getDolphin();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(4.0, 4.0, 4.0);
    }

    protected getAnimationConfig(state: string): SwimmerAnimationConfig {
        const isFleeing = state === DefaultSwimAwayLogic.PHASE_FLEEING;
        return {
            name: isFleeing ? 'swim' : 'idle',
            timeScale: isFleeing ? 1.5 : 1.0,
            randomizeLength: 0.1,
            startTime: -1.0
        };
    }
}
