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
import { DelayLogic } from '../behaviors/logic/DelayLogic';

export interface FlyingAnimalOptions extends AnimalOptions {
    minNoticeDistance?: number,
    flightSpeed?: number;
    zRange?: [number, number];
}

export class FlyingBehaviorFactory {

    public static createShoreLanding(
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

        if (disableLogic) return null;

        // One iteration of see boat, fly, and land
        const script = AnimalLogicStep.sequence([
            {
                name: WaitForBoatLogic.NAME,
                params: { minNoticeDistance: minNoticeDistance, ignoreBottles: true }
            },
            {
                name: ShoreLandingFlightLogic.NAME,
                params: { flightSpeed, zRange }
            }
        ]
        );
        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }

    public static createWaterLanding(
        animal: AnyAnimal,
        params: {
            minNoticeDistance?: number,
            flightSpeed?: number,
            disableLogic?: boolean,
            aggressiveness?: number,
            landingHeight?: number
        }
    ) {
        const {
            minNoticeDistance = 200.0,
            flightSpeed = 1.0,
            disableLogic = false,
            aggressiveness = 0.5,
            landingHeight = 0.0
        } = params;

        if (disableLogic) return null;

        // Loop forever waiting for the boat and then flying
        const script = AnimalLogicStep.until(null, Infinity,
            AnimalLogicStep.sequence([
                {
                    name: WaitForBoatLogic.NAME,
                    params: { waitOnShore: false, minNoticeDistance: minNoticeDistance, ignoreBottles: true }
                },
                {
                    name: WaterLandingFlightLogic.NAME,
                    params: { flightSpeed, landingHeight }
                },
                {
                    name: DelayLogic.NAME,
                    params: { waitOnShore: false, maxDuration: 2.0 }
                }
            ])
        );
        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }
}

export abstract class FlyingAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }
}
