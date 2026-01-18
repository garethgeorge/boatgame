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
import { Animal, AnimalPhysicsOptions } from './Animal';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';

export interface FlyingAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: THREE.Vector3;
    aggressiveness?: number;
    flightSpeed?: number;
}

export abstract class FlyingAnimal extends Animal implements AnyAnimal {

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        options: FlyingAnimalOptions,
        physicsOptions: AnimalPhysicsOptions
    ) {
        super();

        const {
            x,
            y,
            height,
            angle = 0,
            terrainNormal,
            flightSpeed = 1.0
        } = options;


        this.setupPhysicsBody(physicsEngine, subtype, 'obstacle', x, y, angle, physicsOptions);

        this.setupModelMesh(height);

        if (terrainNormal)
            this.normalVector = terrainNormal.clone();
        else
            this.normalVector = new THREE.Vector3(0, 1, 0);

        const logicConfig: AnimalLogicConfig = {
            name: ShoreIdleLogic.NAME,
            params: {
                minNoticeDistance: 200.0,
                ignoreBottles: true,
                nextLogicConfig: {
                    name: DefaultFlightLogic.NAME,
                    params: { flightSpeed }
                }
            }
        };
        const aggressiveness = (options.aggressiveness !== undefined) ? options.aggressiveness : Math.random();
        this.setupBehavior(logicConfig, aggressiveness);
    }

    getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }
}
