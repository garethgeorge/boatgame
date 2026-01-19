import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { DefaultFlightLogic } from '../behaviors/logic/DefaultFlightLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { Animal, AnimalLogicOrchestrator, AnimalOptions, AnimalPhysicsOptions } from './Animal';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Entity } from '../../core/Entity';

export interface FlyingAnimalOptions extends AnimalOptions {
    flightSpeed?: number;
}

export class FlyingLogicOrchestrator implements AnimalLogicOrchestrator {
    private flightSpeed: number;

    constructor(params: { flightSpeed?: number }) {
        this.flightSpeed = params.flightSpeed ?? 1.0;
    }

    getLogicConfig(): AnimalLogicConfig {
        return {
            name: ShoreIdleLogic.NAME,
            params: {
                minNoticeDistance: 200.0,
                ignoreBottles: true,
                nextLogicConfig: {
                    name: DefaultFlightLogic.NAME,
                    params: { flightSpeed: this.flightSpeed }
                }
            }
        };
    }
}

export abstract class FlyingAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }
}
