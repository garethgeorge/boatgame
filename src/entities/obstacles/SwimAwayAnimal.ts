import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehavior, ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalLogicOrchestrator, AnimalPhysicsOptions } from './Animal';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { AnimalLogicConfig } from '../behaviors/logic/AnimalLogic';

export interface SwimAwayAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    aggressiveness?: number;
}


export class SwimAwayLogicOrchestrator implements AnimalLogicOrchestrator {
    getLogicConfig(): AnimalLogicConfig {
        return { name: DefaultSwimAwayLogic.NAME };
    }
}

export abstract class SwimAwayAnimal extends Animal implements AnyAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        entityType: string,
        options: SwimAwayAnimalOptions,
        physicsOptions: AnimalPhysicsOptions,
        orchestrator: AnimalLogicOrchestrator
    ) {
        super();

        const {
            x,
            y,
            height,
            angle = 0,
        } = options;

        // Physics
        this.setupPhysicsBody(physicsEngine, subtype, entityType, x, y, angle, physicsOptions);

        // Graphics
        this.setupModelMesh(height);

        const aggressiveness = (options.aggressiveness !== undefined) ? options.aggressiveness : 1.0;
        this.setupBehavior(orchestrator, aggressiveness);
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }
}
