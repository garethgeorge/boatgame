import { AnyAnimal } from './AnimalBehavior';
import { AnimalLogicScript, AnimalLogicPhase, AnimalLogicStep } from './logic/AnimalLogic';
import { AnimalUniversalBehavior } from './AnimalUniversalBehavior';
import { WaitForBoatParams } from './logic/WaitForBoatLogic';
import { ShoreWalkParams } from './logic/ShoreWalkLogic';

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
        if (behavior.type === 'unicorn') {
            return AnimalLogicStep.loop([
                {
                    name: 'WaitForBoat',
                    params: {
                        forwardMax: 200,
                        phase: AnimalLogicPhase.IDLE_SHORE,
                        ignoreBottles: true
                    }
                },
                {
                    name: 'ShoreWalk',
                    params: {
                        speed: 6,
                        walkDistance: 200,
                        finishWithinDistanceOfBoat: 80
                    }
                },
                {
                    name: 'WaitForBoat',
                    params: {
                        forwardMin: 90,
                        backwardMin: 5,
                        phase: AnimalLogicPhase.IDLE_NEAR,
                        ignoreBottles: true
                    }
                },
                {
                    name: 'WaitForBoat',
                    params: {
                        forwardMin: 220,
                        backwardMin: 220,
                        phase: AnimalLogicPhase.IDLE_SHORE,
                        ignoreBottles: true
                    }
                }
            ]);
        }

        // currently no shore specific logic beyond 'none' which is handled above
        return null;
    }
}
