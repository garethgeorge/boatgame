import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions } from './Animal';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

/**
 * swim - animal is already in water, starts with swim behavior
 * wait - wait on land for boat, enter water, and swim away
 */
export type SwimAwayAnimalBehavior = 'swim' | 'wait';

export interface SwimAwayAnimalOptions extends AnimalOptions {
    swimBehavior?: SwimAwayAnimalBehavior;
}

export class SwimAwayBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            disableLogic?: boolean,
            aggressiveness?: number,
            swimBehavior?: SwimAwayAnimalBehavior,
            heightInWater?: number,
            jumpsIntoWater?: boolean,
        }
    ) {
        const {
            disableLogic = false,
            aggressiveness = 0.5,
            swimBehavior = 'swim',
            heightInWater = 0,
            jumpsIntoWater = false,
        } = params;

        const script = disableLogic ? null : this.getLogicScript(swimBehavior, heightInWater, jumpsIntoWater);

        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script);
        } else {
            return null;
        }
    }

    private static getLogicScript(
        swimBehavior: SwimAwayAnimalBehavior,
        heightInWater: number,
        jumpsIntoWater: boolean,
    ): AnimalLogicScript {
        if (swimBehavior === 'swim') {
            return { name: 'DefaultSwimAway' };
        } else {
            return AnimalLogicStep.sequence([
                {
                    name: 'WaitForBoat',
                    params: { noticeDistance: 50.0, ignoreBottles: true }
                },
                {
                    name: 'EnteringWater',
                    params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
                },
                { name: 'DefaultSwimAway' }
            ]);
        }
    }
}

export abstract class SwimAwayAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }
}
