import { AmbushAttackLogic } from './AmbushAttackLogic';
import { BuzzBoatFlightLogic, BuzzBoatFlightParams } from './BuzzBoatFlightLogic';
import { DefaultSwimAwayLogic } from './DefaultSwimAwayLogic';
import { DelayLogic, DelayParams } from './DelayLogic';
import { EnteringWaterLogic, EnteringWaterParams } from './EnteringWaterLogic';
import { FlyDirectToShoreLogic, FlyDirectToShoreParams } from './FlyDirectToShoreLogic';
import { FlyOppositeBoatLogic, FlyOppositeBoatParams } from './FlyOppositeBoatLogic';
import { ShoreLandingFlightLogic, ShoreLandingFlightParams } from './ShoreLandingFlightLogic';
import { ShoreWalkLogic, ShoreWalkParams } from './ShoreWalkLogic';
import { WaitForBoatLogic, WaitForBoatParams } from './WaitForBoatLogic';
import { WanderingFlightLogic, WanderingFlightParams } from './WanderingFlightLogic';
import { WaterLandingFlightLogic, WaterLandingFlightParams } from './WaterLandingFlightLogic';
import { WolfAttackLogic } from './WolfAttackLogic';

export interface AnimalLogicBaseConfig {
    timeout?: number;
}

export type AnimalLogicConfig =
    | ({ name: 'AmbushAttack'; params?: never } & AnimalLogicBaseConfig)
    | ({ name: 'BuzzBoatFlight'; params: BuzzBoatFlightParams } & AnimalLogicBaseConfig)
    | ({ name: 'DefaultSwimAway'; params?: never } & AnimalLogicBaseConfig)
    | ({ name: 'Delay'; params: DelayParams } & AnimalLogicBaseConfig)
    | ({ name: 'EnteringWater'; params: EnteringWaterParams } & AnimalLogicBaseConfig)
    | ({ name: 'FlyDirectToShore'; params: FlyDirectToShoreParams } & AnimalLogicBaseConfig)
    | ({ name: 'FlyOppositeBoat'; params: FlyOppositeBoatParams } & AnimalLogicBaseConfig)
    | ({ name: 'ShoreLandingFlight'; params: ShoreLandingFlightParams } & AnimalLogicBaseConfig)
    | ({ name: 'ShoreWalk'; params: ShoreWalkParams } & AnimalLogicBaseConfig)
    | ({ name: 'WaitForBoat'; params: WaitForBoatParams } & AnimalLogicBaseConfig)
    | ({ name: 'WanderingFlight'; params: WanderingFlightParams } & AnimalLogicBaseConfig)
    | ({ name: 'WaterLandingFlight'; params: WaterLandingFlightParams } & AnimalLogicBaseConfig)
    | ({ name: 'WolfAttack'; params?: never } & AnimalLogicBaseConfig);
