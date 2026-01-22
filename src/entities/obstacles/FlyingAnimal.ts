import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { ShoreLandingFlightLogic } from '../behaviors/logic/ShoreLandingFlightLogic';
import { WaterLandingFlightLogic } from '../behaviors/logic/WaterLandingFlightLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { WaitForBoatLogic } from '../behaviors/logic/WaitForBoatLogic';
import { Animal, AnimalOptions } from './Animal';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

export interface FlyingAnimalOptions extends AnimalOptions {
    minNoticeDistance?: number,
    flightSpeed?: number;
    zRange?: [number, number];
    landingLogic?: 'shore' | 'water';
    landingHeight?: number;
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
            landingLogic?: 'shore' | 'water',
            landingHeight?: number
        }
    ) {
        const {
            minNoticeDistance = 200.0,
            flightSpeed = 1.0,
            disableLogic = false,
            aggressiveness = 0.5,
            zRange,
            landingLogic = 'shore',
            landingHeight = 0.0
        } = params;
        const script = disableLogic ? null : this.getLogicScript(minNoticeDistance, flightSpeed, landingLogic, zRange, landingHeight);
        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script);
        } else {
            return null;
        }
    }

    private static getLogicScript(
        minNoticeDistance: number,
        flightSpeed: number,
        landingLogic: 'shore' | 'water',
        zRange?: [number, number],
        landingHeight: number = 0.0
    ): AnimalLogicScript {
        const flightLogicName = landingLogic === 'water' ? WaterLandingFlightLogic.NAME : ShoreLandingFlightLogic.NAME;
        const flightParams = landingLogic === 'water' ? { flightSpeed, landingHeight } : { flightSpeed, zRange };

        return AnimalLogicStep.sequence([
            {
                name: WaitForBoatLogic.NAME,
                params: { minNoticeDistance: minNoticeDistance, ignoreBottles: true }
            },
            {
                name: flightLogicName,
                params: flightParams
            }
        ]);
    }
}

export abstract class FlyingAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }
}
