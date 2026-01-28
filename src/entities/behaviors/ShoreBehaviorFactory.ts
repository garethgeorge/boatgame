import { AnyAnimal } from './AnimalBehavior';
import { AnimalLogicScript } from './logic/AnimalLogic';
import { AnimalUniversalBehavior } from './AnimalUniversalBehavior';

import { ShoreBehaviorConfig, AnimalBehaviorConfig } from './AnimalBehaviorConfigs';

export class ShoreBehaviorFactory {

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

