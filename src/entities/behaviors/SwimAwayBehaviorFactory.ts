import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from './AnimalBehavior';
import { AnimalLogicScript, AnimalLogicStep, AnimalLogicPhase } from './logic/AnimalLogic';
import { WaitForBoatLogic } from './logic/WaitForBoatLogic';
import { AnimalUniversalBehavior } from './AnimalUniversalBehavior';
import { AnimalBehaviorConfig } from './AnimalBehaviorConfigs';

export class SwimAwayBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            disableLogic?: boolean,
            aggressiveness?: number,
            heightInWater?: number,
            jumpsIntoWater?: boolean,
            behavior?: AnimalBehaviorConfig
            zRange?: [number, number]
        }
    ) {

        const {
            disableLogic = false,
            aggressiveness = 0.5,
            heightInWater = 0,
            jumpsIntoWater = false,
            behavior,
            zRange
        } = params;

        if (disableLogic || !behavior) {
            return null;
        }

        let script = undefined;
        switch (behavior.type) {
            case 'swim':
                script = this.swim(zRange);
                break;
            case 'wait-swim':
                script = this.wait_swim(heightInWater, jumpsIntoWater, zRange);
                break;
            case 'walk-swim':
                script = this.walk_swim(heightInWater, jumpsIntoWater, zRange);
                break;
        }

        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, heightInWater, script);
        } else {
            return null;
        }
    }

    private static swim(
        zRange: [number, number] | undefined
    ): AnimalLogicScript {
        return AnimalLogicStep.loop([
            {
                name: 'SwimAway',
                params: { zRange }
            },
            {
                name: 'SwimBackInRange',
                params: { zRange }
            }
        ]);
    }

    private static wait_swim(
        heightInWater: number,
        jumpsIntoWater: boolean,
        zRange: [number, number] | undefined
    ): AnimalLogicScript {

        return AnimalLogicStep.loop([
            {
                name: 'WaitForBoat',
                params: {
                    forwardMax: 50.0,
                    ignoreBottles: true,
                    phase: AnimalLogicPhase.IDLE_SHORE
                }
            },
            {
                name: 'EnteringWater',
                params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
            },
            {
                name: 'SwimAway',
                params: { zRange }
            },
            {
                name: 'SwimBackInRange',
                params: { zRange }
            }
        ]);
    }

    private static walk_swim(
        heightInWater: number,
        jumpsIntoWater: boolean,
        zRange: [number, number] | undefined
    ): AnimalLogicScript {

        return AnimalLogicStep.sequence([
            AnimalLogicStep.until(WaitForBoatLogic.RESULT_NOTICED, Infinity,
                AnimalLogicStep.random([
                    {
                        name: 'WaitForBoat',
                        params: {
                            phase: AnimalLogicPhase.IDLE_SHORE,
                            forwardMax: 50,
                            ignoreBottles: true
                        },
                        timeout: 5.0
                    },
                    {
                        name: 'ShoreWalk',
                        params: {
                            walkDistance: 10 + Math.random() * 10,
                            speed: 0.8 + Math.random() * 0.4,
                            finishWithinDistanceOfBoat: 50
                        }
                    },
                ])
            ),
            {
                name: 'EnteringWater',
                params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
            },
            AnimalLogicStep.loop([
                {
                    name: 'SwimAway',
                    params: { zRange }
                },
                {
                    name: 'SwimBackInRange',
                    params: { zRange }
                }
            ])
        ]);
    }
}

