import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehavior, ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalPhysicsOptions } from './Animal';

export interface SwimAwayAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    aggressiveness?: number;
}

export abstract class SwimAwayAnimal extends Animal implements AnyAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        entityType: string,
        options: SwimAwayAnimalOptions,
        physicsOptions: AnimalPhysicsOptions
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
        this.setupBehavior({ name: 'swimaway' }, aggressiveness);
    }

    getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }
}
