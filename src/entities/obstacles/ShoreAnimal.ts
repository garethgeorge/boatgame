import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalBehaviorConfig } from './Animal';
import { AnimalLogicScript } from '../behaviors/logic/AnimalLogic';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

export class ShoreAnimalBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            disableLogic?: boolean,
            aggressiveness?: number,
            behavior?: AnimalBehaviorConfig
        }
    ) {
        const {
            disableLogic = false,
            aggressiveness = 0.5,
            behavior
        } = params;

        if (disableLogic || !behavior || behavior.type === 'none') {
            return null;
        }

        const script = this.getLogicScript(behavior);

        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script);
        } else {
            return null;
        }
    }

    private static getLogicScript(
        behavior: AnimalBehaviorConfig,
    ): AnimalLogicScript {
        // currently no shore specific logic beyond 'none' which is handled above
        return null;
    }
}


export abstract class ShoreAnimal extends Animal implements AnyAnimal {
    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
