import * as planck from 'planck';
import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { ShoreLandingFlightLogic } from '../behaviors/logic/ShoreLandingFlightLogic';
import { WaterLandingFlightLogic } from '../behaviors/logic/WaterLandingFlightLogic';
import { WanderingFlightLogic } from '../behaviors/logic/WanderingFlightLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { WaitForBoatLogic } from '../behaviors/logic/WaitForBoatLogic';
import { Animal, AnimalOptions } from './Animal';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { DelayLogic } from '../behaviors/logic/DelayLogic';
import { BuzzBoatFlightLogic } from '../behaviors/logic/BuzzBoatFlightLogic';
import { FlyDirectToShoreLogic } from '../behaviors/logic/FlyDirectToShoreLogic';
import { FlyOppositeBoatLogic } from '../behaviors/logic/FlyOppositeBoatLogic';

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

        // wait for boat
        // buzz boat
        // fly away and land on shore
        // if out of range fly direct to shore
        const script = (step: number, lastResult: string) => {
            if (lastResult === '') {
                return {
                    name: WaitForBoatLogic.NAME,
                    params: { minNoticeDistance: minNoticeDistance, ignoreBottles: true }
                };
            }
            if (lastResult === WaitForBoatLogic.RESULT_NOTICED) {
                return {
                    name: BuzzBoatFlightLogic.NAME,
                    params: { flightSpeed, zRange }
                }
            }
            if (lastResult === BuzzBoatFlightLogic.RESULT_FINISHED) {
                return {
                    name: ShoreLandingFlightLogic.NAME,
                    params: { flightSpeed, zRange }
                }
            }
            if (lastResult === BuzzBoatFlightLogic.RESULT_OUT_OF_RANGE ||
                lastResult === ShoreLandingFlightLogic.RESULT_OUT_OF_RANGE) {
                return {
                    name: FlyDirectToShoreLogic.NAME,
                    params: { flightSpeed, zRange }
                }
            }
            return null;
        };
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

        // wait for boat (first time has a far notice distance)
        // buzz boat
        // fly away for a bit and land in water
        // repeat
        const script = (step: number, lastResult: string) => {
            if (lastResult === '' || lastResult === DelayLogic.RESULT_FINISHED) {
                return {
                    name: WaitForBoatLogic.NAME,
                    params: {
                        minNoticeDistance: step == 0 ? minNoticeDistance : 5.0,
                        ignoreBottles: true
                    }
                };
            }
            if (lastResult === WaitForBoatLogic.RESULT_NOTICED) {
                return {
                    name: BuzzBoatFlightLogic.NAME,
                    params: { flightSpeed }
                }
            }
            if (lastResult === BuzzBoatFlightLogic.RESULT_FINISHED) {
                return {
                    name: WaterLandingFlightLogic.NAME,
                    params: { flightSpeed, landingHeight }
                }
            }
            if (lastResult === WaterLandingFlightLogic.RESULT_FINISHED) {
                return {
                    name: DelayLogic.NAME,
                    params: { waitOnShore: false, maxDuration: 2.0 }
                }
            }
            return null;
        };
        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }

    public static createWandering(
        animal: AnyAnimal,
        params: {
            flightSpeed?: number,
            flightHeight?: number,
            noticeDistance?: number,
            buzzDuration?: number,
            buzzHeight?: number,
            buzzOffset?: number,
            wanderRadius?: number,
            aggressiveness?: number,
            disableLogic?: boolean,
        }
    ) {
        const {
            flightSpeed = 1.0,
            noticeDistance = 50.0,
            buzzDuration = 10.0,
            buzzHeight = 2.5,
            buzzOffset = 5.0,
            wanderRadius = 20.0,
            flightHeight = 15.0,
            aggressiveness = 0.5,
            disableLogic = false
        } = params;

        if (disableLogic) return null;

        // wander around until boat is near
        // fly to and buzz the boat
        // fly off behind the boat
        // repeat
        const script = (step: number, lastResult: string) => {
            console.log(lastResult);
            if (lastResult === '' || lastResult === FlyOppositeBoatLogic.RESULT_FINISHED) {
                return {
                    name: WanderingFlightLogic.NAME,
                    params: {
                        flightSpeed,
                        wanderHeight: flightHeight,
                        noticeDistance: noticeDistance,
                        noticeDelay: 2.0,
                        wanderRadius,
                    }
                };
            }
            if (lastResult === WanderingFlightLogic.RESULT_NOTICED) {
                return {
                    name: BuzzBoatFlightLogic.NAME,
                    params: {
                        flightSpeed,
                        maxHeight: flightHeight,
                        buzzOffset,
                        buzzHeight,
                        buzzTimeout: buzzDuration
                    }
                };
            }
            if (lastResult === BuzzBoatFlightLogic.RESULT_FINISHED) {
                return {
                    name: FlyOppositeBoatLogic.NAME,
                    params: {
                        flightSpeed, flightHeight, distance: noticeDistance
                    }
                }
            }
            return null;
        };

        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }
}

export abstract class FlyingAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return null;
    }
}
