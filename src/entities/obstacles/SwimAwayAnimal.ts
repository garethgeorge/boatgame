import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions } from './Animal';
import { DefaultSwimAwayLogic } from '../behaviors/logic/DefaultSwimAwayLogic';
import { AnimalLogicScript } from '../behaviors/logic/AnimalLogic';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

export interface SwimAwayAnimalOptions extends AnimalOptions {
}

export class SwimAwayBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            disableLogic?: boolean,
            aggressiveness?: number,
        }
    ) {
        const {
            disableLogic = false,
            aggressiveness = 0.5,
        } = params;
        const script = disableLogic ? null : this.getLogicScript();
        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script);
        } else {
            return null;
        }
    }

    private static getLogicScript(): AnimalLogicScript {
        return { name: DefaultSwimAwayLogic.NAME };
    }
}

export abstract class SwimAwayAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 };
    }
}
