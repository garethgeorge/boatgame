import * as planck from 'planck';
import * as THREE from 'three';
import { WaitForBoatLogic } from '../behaviors/logic/WaitForBoatLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicConfig } from '../behaviors/logic/AnimalLogicConfigs';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions, AnimalBehaviorConfig } from './Animal';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

export class AttackBehaviorFactory {
    public static create(
        animal: AnyAnimal,
        params: {
            aggressiveness?: number;
            disableLogic?: boolean,
            heightInWater?: number,
            jumpsIntoWater?: boolean,
            snoutOffset?: number,
            behavior?: AnimalBehaviorConfig
        }
    ) {
        const {
            aggressiveness = 0.5,
            disableLogic = false,
            heightInWater = 0,
            jumpsIntoWater = false,
            snoutOffset = 0,
            behavior
        } = params;

        if (disableLogic || !behavior || behavior.type === 'none') {
            return null;
        }

        const snoutVector = this.getSnoutVector(snoutOffset);
        const script = this.getLogicScript(behavior, heightInWater, jumpsIntoWater);

        if (script) {
            return new AnimalUniversalBehavior(animal, aggressiveness, script, snoutVector);
        } else {
            return null;
        }
    }

    private static getSnoutVector(snoutOffset: number): planck.Vec2 {
        // assume snout is on -y axis
        return planck.Vec2(0, -snoutOffset);
    }

    private static getLogicScript(
        behavior: AnimalBehaviorConfig,
        heightInWater: number,
        jumpsIntoWater: boolean,
    ): AnimalLogicScript {
        if (behavior.type === 'attack') {
            return { name: behavior.logicName } as AnimalLogicConfig;
        } else if (behavior.type === 'wait-attack') {
            return AnimalLogicStep.sequence([
                {
                    name: 'WaitForBoat',
                },
                {
                    name: 'EnteringWater',
                    params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
                },
                { name: behavior.logicName } as AnimalLogicConfig
            ]);
        } else if (behavior.type === 'walk-attack') {
            return AnimalLogicStep.sequence([
                AnimalLogicStep.until(WaitForBoatLogic.RESULT_NOTICED, Infinity,
                    AnimalLogicStep.random([
                        {
                            name: 'WaitForBoat',
                            timeout: 5.0,
                        },
                        {
                            name: 'ShoreWalk',
                            params: {
                                walkDistance: 10 + Math.random() * 10,
                                speed: 0.8 + Math.random() * 0.4
                            }
                        },
                    ])
                ),
                {
                    name: 'EnteringWater',
                    params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
                },
                { name: behavior.logicName } as AnimalLogicConfig
            ]);
        }
        return null;
    }
}


export abstract class AttackAnimal extends Animal implements AnyAnimal {

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
