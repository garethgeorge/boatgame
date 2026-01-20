import * as planck from 'planck';
import * as THREE from 'three';
import { WolfAttackLogic } from '../behaviors/logic/WolfAttackLogic';
import { EnteringWaterLogic } from '../behaviors/logic/EnteringWaterLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalOptions } from './Animal';
import { ShoreWalkLogic } from '../behaviors/logic/ShoreWalkLogic';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';

export interface AttackAnimalOptions extends AnimalOptions {
    attackLogicName?: string;
    onShore?: boolean;
    stayOnShore?: boolean;
}

export class AttackBehaviorFactory {

    public static create(
        animal: AnyAnimal,
        params: {
            aggressiveness?: number;
            attackLogicName?: string,
            disableLogic?: boolean,
            onShore?: boolean,
            stayOnShore?: boolean,
            heightInWater?: number,
            jumpsIntoWater?: boolean,
            walkabout?: boolean,
            snoutOffset?: number
        }
    ) {
        const {
            aggressiveness = 0.5,
            attackLogicName = WolfAttackLogic.NAME,
            disableLogic = false,
            onShore = false,
            stayOnShore = false,
            heightInWater = 0,
            jumpsIntoWater = false,
            walkabout = false,
            snoutOffset = 0
        } = params;
        const snoutVector = this.getSnoutVector(snoutOffset);

        const script = disableLogic ? null :
            this.getLogicScript(attackLogicName, onShore, stayOnShore, walkabout, heightInWater, jumpsIntoWater);
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
        onShore: boolean,
        stayOnShore: boolean,
        walkabout: boolean,
        heightInWater: number,
        jumpsIntoWater: boolean,
    ): AnimalLogicScript {
        if (onShore && stayOnShore) {
            return null;
        } else if (onShore) {
            if (!walkabout) {
                return AnimalLogicStep.sequence([
                    {
                        name: ShoreIdleLogic.NAME,
                    },
                    {
                        name: EnteringWaterLogic.NAME,
                        params: { targetWaterHeight: heightInWater, jump: jumpsIntoWater }
                    },
                    {
                        name: attackLogicName
                    }
                ]);
            } else {
                return AnimalLogicStep.sequence([
                    AnimalLogicStep.until(ShoreIdleLogic.RESULT_NOTICED,
                        AnimalLogicStep.random([
                            {
                                name: ShoreIdleLogic.NAME,
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
        } else {
            return { name: attackLogicName };
        }
    }
}

export abstract class AttackAnimal extends Animal implements AnyAnimal {

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
