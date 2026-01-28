import * as planck from 'planck';
import * as THREE from 'three';
import { ShoreLandingFlightLogic } from './logic/ShoreLandingFlightLogic';
import { WaterLandingFlightLogic } from './logic/WaterLandingFlightLogic';
import { WanderingFlightLogic } from './logic/WanderingFlightLogic';
import { AnyAnimal } from './AnimalBehavior';
import { WaitForBoatLogic } from './logic/WaitForBoatLogic';
import { AnimalUniversalBehavior } from './AnimalUniversalBehavior';
import { DelayLogic } from './logic/DelayLogic';
import { BuzzBoatFlightLogic } from './logic/BuzzBoatFlightLogic';
import { FlyOppositeBoatLogic } from './logic/FlyOppositeBoatLogic';
import { AnimalLogicPhase } from './logic/AnimalLogic';
import { WaitForBoatParams } from './logic/WaitForBoatLogic';

// FlyingAnimalOptions removed, use AnimalOptions directly


export class FlyingBehaviorFactory {

    public static createShoreLanding(
        animal: AnyAnimal,
        params: {
            disableLogic?: boolean,
            aggressiveness?: number,
            noticeDistance?: number,
            flightSpeed?: number,
            zRange?: [number, number],
        }
    ) {
        const {
            disableLogic = false,
            aggressiveness = 0.5,
            noticeDistance = 200.0,
            flightSpeed = 1.0,
            zRange,
        } = params;

        if (disableLogic) return null;

        // wait for boat
        // buzz boat
        // fly away and land on shore
        // if out of range fly direct to shore
        // stop
        const script = (step: number, lastResult: string): any => {
            switch (lastResult) {
                case '': {
                    return {
                        name: 'WaitForBoat',
                        params: {
                            forwardMax: noticeDistance,
                            ignoreBottles: true,
                            phase: AnimalLogicPhase.IDLE_SHORE
                        }
                    };
                }
                case WaitForBoatLogic.RESULT_NOTICED: {
                    return {
                        name: 'BuzzBoatFlight',
                        params: { flightSpeed, zRange }
                    }
                }
                case BuzzBoatFlightLogic.RESULT_FINISHED: {
                    return {
                        name: 'ShoreLandingFlight',
                        params: { flightSpeed, zRange }
                    }
                }
                case BuzzBoatFlightLogic.RESULT_OUT_OF_RANGE:
                case ShoreLandingFlightLogic.RESULT_OUT_OF_RANGE: {
                    return {
                        name: 'FlyDirectToShore',
                        params: { flightSpeed, zRange }
                    }
                }
                default: {
                    return null;
                }
            }
        };
        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }

    public static createWaterLanding(
        animal: AnyAnimal,
        params: {
            noticeDistance?: number,
            flightSpeed?: number,
            landingHeight?: number
            disableLogic?: boolean,
            aggressiveness?: number,
        }
    ) {
        const {
            noticeDistance = 200.0,
            flightSpeed = 1.0,
            landingHeight = 0.0,
            disableLogic = false,
            aggressiveness = 0.5,
        } = params;

        if (disableLogic) return null;

        // wait for boat (first time has a far notice distance)
        // buzz boat
        // fly away for a bit and land in water
        // repeat
        const script = (step: number, lastResult: string): any => {
            if (lastResult === '' || lastResult === DelayLogic.RESULT_FINISHED) {
                return {
                    name: 'WaitForBoat',
                    params: {
                        forwardMax: step == 0 ? noticeDistance : 5.0,
                        ignoreBottles: true,
                        phase: AnimalLogicPhase.IDLE_SHORE
                    } as WaitForBoatParams
                };
            }
            if (lastResult === WaitForBoatLogic.RESULT_NOTICED) {
                return {
                    name: 'BuzzBoatFlight',
                    params: { flightSpeed }
                }
            }
            if (lastResult === BuzzBoatFlightLogic.RESULT_FINISHED) {
                return {
                    name: 'WaterLandingFlight',
                    params: { flightSpeed, landingHeight }
                }
            }
            if (lastResult === WaterLandingFlightLogic.RESULT_FINISHED) {
                return {
                    name: 'Delay',
                    params: {
                        waitOnShore: false,
                        maxDuration: 2.0,
                        phase: AnimalLogicPhase.IDLE_WATER
                    }
                }
            }
            return null;
        };
        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }

    public static createWandering(
        animal: AnyAnimal,
        params: {
            noticeDistance?: number,
            flightSpeed?: number,
            flightHeight?: number,
            buzzDuration?: number,
            buzzHeight?: number,
            buzzOffset?: number,
            wanderRadius?: number,
            aggressiveness?: number,
            disableLogic?: boolean,
        }
    ) {
        const {
            noticeDistance = 50.0,
            flightSpeed = 1.0,
            flightHeight = 15.0,
            buzzDuration = 2.0,
            buzzHeight = 2.5,
            buzzOffset = 5.0,
            wanderRadius = 20.0,
            aggressiveness = 0.5,
            disableLogic = false
        } = params;

        if (disableLogic) return null;

        // wander around until boat is near
        // fly to and buzz the boat
        // fly off behind the boat
        // repeat
        const script = (step: number, lastResult: string): any => {
            if (lastResult === '' || lastResult === FlyOppositeBoatLogic.RESULT_FINISHED) {
                return {
                    name: 'WanderingFlight',
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
                    name: 'BuzzBoatFlight',
                    params: {
                        flightSpeed,
                        flightHeight,
                        buzzOffset,
                        buzzHeight,
                        buzzTimeout: buzzDuration
                    }
                };
            }
            if (lastResult === BuzzBoatFlightLogic.RESULT_FINISHED) {
                return {
                    name: 'FlyOppositeBoat',
                    params: {
                        flightSpeed, flightHeight, distance: noticeDistance / 3
                    }
                }
            }
            return null;
        };

        return new AnimalUniversalBehavior(animal, aggressiveness, script);
    }
}
