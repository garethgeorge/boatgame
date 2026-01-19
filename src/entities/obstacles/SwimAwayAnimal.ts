import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehavior, ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalLogicOrchestrator, AnimalOptions, AnimalPhysicsOptions } from './Animal';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { AnimalLogicConfig, AnimalLogicScript } from '../behaviors/logic/AnimalLogic';

export interface SwimAwayAnimalOptions extends AnimalOptions {
}

export class SwimAwayLogicOrchestrator implements AnimalLogicOrchestrator {
    getLogicScript(): AnimalLogicScript {
        return { name: DefaultSwimAwayLogic.NAME };
    }
}

export abstract class SwimAwayAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }
}
