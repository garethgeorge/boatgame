import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions } from './Animal';
import { AnimalLogicScript } from '../behaviors/logic/AnimalLogic';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

/**
 * none - animal has no behavior, just stays put
 */
export type ShoreAnimalBehavior = 'none';

export interface ShoreAnimalOptions extends AnimalOptions {
    shoreBehavior?: ShoreAnimalBehavior;
}

export class ShoreAnimalBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            disableLogic?: boolean,
            aggressiveness?: number,
            shoreBehavior?: ShoreAnimalBehavior,
        }
    ) {
        const {
            disableLogic = false,
            aggressiveness = 0.5,
            shoreBehavior = 'none',
        } = params;

        const script = disableLogic ? null : this.getLogicScript(shoreBehavior);

        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script);
        } else {
            return null;
        }
    }

    private static getLogicScript(
        shoreBehavior: ShoreAnimalBehavior,
    ): AnimalLogicScript {
        if (shoreBehavior === 'none') {
            return null;
        }
        return null;
    }
}

export abstract class ShoreAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
