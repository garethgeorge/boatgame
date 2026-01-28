import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalBehaviorConfig } from './Animal';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

export class SwimAwayBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            disableLogic?: boolean,
            aggressiveness?: number,
            heightInWater?: number,
            jumpsIntoWater?: boolean,
            behavior?: AnimalBehaviorConfig
        }
    ) {
        const {
            disableLogic = false,
            aggressiveness = 0.5,
            heightInWater = 0,
            jumpsIntoWater = false,
            behavior
        } = params;

        if (disableLogic || !behavior || behavior.type === 'none') {
            return null;
        }

        const script = this.getLogicScript(behavior, heightInWater, jumpsIntoWater);

        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script);
        } else {
            return null;
        }
    }

    private static getLogicScript(
        behavior: AnimalBehaviorConfig,
        heightInWater: number,
        jumpsIntoWater: boolean,
    ): AnimalLogicScript {
        if (behavior.type === 'swim') {
            return { name: 'DefaultSwimAway' };
        } else if (behavior.type === 'wait-swim') {
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
        return null;
    }
}


export abstract class SwimAwayAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }
}
