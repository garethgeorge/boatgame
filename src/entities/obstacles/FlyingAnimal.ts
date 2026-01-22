import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { DefaultFlightLogic } from '../behaviors/logic/DefaultFlightLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { Animal, AnimalOptions } from './Animal';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

export interface FlyingAnimalOptions extends AnimalOptions {
    minNoticeDistance?: number,
    flightSpeed?: number;
    zRange?: [number, number];
}

export class FlyingBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            minNoticeDistance?: number,
            flightSpeed?: number,
            disableLogic?: boolean,
            aggressiveness?: number,
            zRange?: [number, number],
        }
    ) {
        const {
            minNoticeDistance = 200.0,
            flightSpeed = 1.0,
            disableLogic = false,
            aggressiveness = 0.5,
            zRange,
        } = params;
        const script = disableLogic ? null : this.getLogicScript(minNoticeDistance, flightSpeed, zRange);
        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script);
        } else {
            return null;
        }
    }

    private static getLogicScript(
        minNoticeDistance: number,
        flightSpeed: number,
        zRange?: [number, number]
    ): AnimalLogicScript {
        return AnimalLogicStep.sequence([
            {
                name: ShoreIdleLogic.NAME,
                params: { minNoticeDistance: minNoticeDistance, ignoreBottles: true }
            },
            {
                name: DefaultFlightLogic.NAME,
                params: { flightSpeed: flightSpeed, zRange: zRange }
            }
        ]);
    }
}

export abstract class FlyingAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }
}
