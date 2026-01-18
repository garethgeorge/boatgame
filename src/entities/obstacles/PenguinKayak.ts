import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { SwimAwayAnimal, SwimmerAnimationConfig } from './SwimAwayAnimal';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';

export class PenguinKayak extends SwimAwayAnimal {

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super(
            physicsEngine,
            'penguinKayak',
            Entity.TYPE_OBSTACLE,
            { x, y, height: 0.5, angle },
            { halfWidth: 1.5, halfLength: 3.0 }
        );
    }

    protected getModelData() {
        return Decorations.getPenguinKayak();
    }

    protected setupModel(model: THREE.Group) {
        model.scale.set(2.0, 2.0, 2.0);
        model.rotation.y = Math.PI / 2.0;
        model.position.y = -0.4;
    }

    protected getAnimationConfig(state: AnimalLogicPhase): SwimmerAnimationConfig {
        const timeScale = state === AnimalLogicPhase.FLEEING ? 3.5 : 2.0;
        return {
            name: 'paddling',
            timeScale: timeScale,
            randomizeLength: 0.2,
            startTime: -1.0
        };
    }

    protected override getHitBehaviorOptions() {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
