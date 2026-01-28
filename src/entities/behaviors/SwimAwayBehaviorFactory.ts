import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from './AnimalBehavior';
import { Animal, AnimalOptions } from '../obstacles/Animal';

import { AnimalLogicScript, AnimalLogicStep } from './logic/AnimalLogic';
import { AnimalUniversalBehavior } from './AnimalUniversalBehavior';

import { SwimAwayBehaviorConfig, AnimalBehaviorConfig } from './AnimalBehaviorConfigs';

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

