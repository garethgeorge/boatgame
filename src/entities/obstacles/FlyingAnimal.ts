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

        // wait for boat
        // buzz boat
        // fly away for a bit and land in water
        // repeat
        const script = (step: number, lastResult: string) => {
            if (lastResult === '' || lastResult === WaterLandingFlightLogic.RESULT_FINISHED) {
                return {
                    name: WaitForBoatLogic.NAME,
                    params: { minNoticeDistance: minNoticeDistance, ignoreBottles: true }
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
            return null;
        };
        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }

    public static createWandering(
        animal: AnyAnimal,
        params: {
            flightSpeed?: number,
            noticeDistance?: number,
            buzzDuration?: number,
            buzzHeight?: number,
            buzzOffset?: number,
            wanderRadius?: number,
            maxHeight?: number,
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
            maxHeight = 15.0,
            aggressiveness = 0.5,
            disableLogic = false
        } = params;

        if (disableLogic) return null;

        // wander around until boat is near
        // fly to and buzz the boat
        // repeat
        const script = (step: number, lastResult: string) => {
            if (lastResult === '' || lastResult === BuzzBoatFlightLogic.RESULT_FINISHED) {
                const firstTime = step === 0;
                return {
                    name: WanderingFlightLogic.NAME,
                    params: {
                        flightSpeed,
                        noticeDistance: noticeDistance,
                        noticeDelay: firstTime ? 0.0 : 5.0,
                        wanderRadius,
                        maxHeight,
                        moveToCenter: !firstTime
                    }
                };
            }
            if (lastResult === WanderingFlightLogic.RESULT_NOTICED) {
                return {
                    name: BuzzBoatFlightLogic.NAME,
                    params: {
                        buzzOffset,
                        maxHeight,
                        buzzHeight,
                        flightSpeed,
                        buzzTimeout: buzzDuration
                    }
                };
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
