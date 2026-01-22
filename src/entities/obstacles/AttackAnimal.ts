import * as planck from 'planck';
import * as THREE from 'three';
import { WolfAttackLogic } from '../behaviors/logic/WolfAttackLogic';
import { EnteringWaterLogic } from '../behaviors/logic/EnteringWaterLogic';
import { WaitForBoatLogic } from '../behaviors/logic/WaitForBoatLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions } from './Animal';
import { ShoreWalkLogic } from '../behaviors/logic/ShoreWalkLogic';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

/**
 * none - animal has no behavior, just stays put
 * attack - for animals that are already in water, starts with attack logic
 * wait - wait on land for boat, enter water, and attack
 * wait - wait on land for boat periodically take a walk, enter water, and attack
 */
export type AttackAnimalBehavior = 'none' | 'attack' | 'wait' | 'walk';

export interface AttackAnimalOptions extends AnimalOptions {
    attackLogicName?: string;
    attackBehavior?: AttackAnimalBehavior;
}

export class AttackBehaviorFactory {
    public static create(
        animal: AnyAnimal,
        params: {
            aggressiveness?: number;
            attackLogicName?: string,
            attackBehavior?: AttackAnimalBehavior,
            disableLogic?: boolean,
            heightInWater?: number,
            jumpsIntoWater?: boolean,
            snoutOffset?: number
        }
    ) {
        const {
            aggressiveness = 0.5,
            attackLogicName = WolfAttackLogic.NAME,
            attackBehavior = 'none',
            disableLogic = false,
            heightInWater = 0,
            jumpsIntoWater = false,
            snoutOffset = 0
        } = params;
        const snoutVector = this.getSnoutVector(snoutOffset);

        const script = disableLogic ? null :
            this.getLogicScript(attackLogicName, attackBehavior, heightInWater, jumpsIntoWater);
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
        attackLogicName: string,
        attackBehavior: AttackAnimalBehavior,
        heightInWater: number,
        jumpsIntoWater: boolean,
    ): AnimalLogicScript {
        if (attackBehavior === 'none') {
            return null;
        } else if (attackBehavior === 'attack') {
            return { name: attackLogicName };
        } else if (attackBehavior === 'wait') {
            return AnimalLogicStep.sequence([
                {
                    name: WaitForBoatLogic.NAME,
                },
                {
                    name: EnteringWaterLogic.NAME,
                    params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
                },
                {
                    name: attackLogicName
                }
            ]);
        } else if (attackBehavior === 'walk') {
            return AnimalLogicStep.sequence([
                AnimalLogicStep.until(WaitForBoatLogic.RESULT_NOTICED,
                    AnimalLogicStep.random([
                        {
                            name: WaitForBoatLogic.NAME,
                            timeout: 5.0,
                        },
                        {
                            name: ShoreWalkLogic.NAME,
                            params: {
                                walkDistance: 10 + Math.random() * 10,
                                speed: 0.8 + Math.random() * 0.4
                            }
                        },
                    ])
                ),
                {
                    name: EnteringWaterLogic.NAME,
                    params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
                },
                {
                    name: attackLogicName
                }
            ]);
        }
    }
}

export abstract class AttackAnimal extends Animal implements AnyAnimal {

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
