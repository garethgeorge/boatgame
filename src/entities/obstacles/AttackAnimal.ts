import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { WolfAttackLogic } from '../behaviors/logic/WolfAttackLogic';
import { EnteringWaterLogic } from '../behaviors/logic/EnteringWaterLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicConfig, AnimalLogicPhase, AnimalLogicScript, AnimalLogicStep } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalLogicOrchestrator, AnimalOptions, AnimalPhysicsOptions } from './Animal';
import { ShoreWalkLogic } from '../behaviors/logic/ShoreWalkLogic';

export interface AttackAnimalOptions extends AnimalOptions {
    onShore?: boolean;
    stayOnShore?: boolean;
    attackLogicName?: string;
}

export class AttackLogicOrchestrator implements AnimalLogicOrchestrator {
    protected attackLogicName: string;
    protected heightInWater: number;
    protected jumpsIntoWater: boolean;
    protected onShore: boolean;
    protected stayOnShore: boolean;
    protected walkabout: boolean;

    constructor(
        params: {
            attackLogicName: string,
            heightInWater: number,
            jumpsIntoWater?: boolean,
            onShore?: boolean,
            stayOnShore?: boolean,
            walkabout?: boolean
        }
    ) {
        this.attackLogicName = params.attackLogicName;
        this.heightInWater = params.heightInWater;
        this.jumpsIntoWater = params.jumpsIntoWater ?? false;
        this.onShore = params.onShore ?? false;
        this.stayOnShore = params.stayOnShore ?? false;
        this.walkabout = params.walkabout ?? false;
    }

    getSnoutOffset(halfLength: number): planck.Vec2 {
        // assume snout is on -y axis
        return planck.Vec2(0, -halfLength);
    }

    getLogicScript(): AnimalLogicScript {
        if (this.onShore && this.stayOnShore) {
            return null;
        } else if (this.onShore) {
            if (!this.walkabout) {
                return AnimalLogicStep.sequence([
                    {
                        name: ShoreIdleLogic.NAME,
                    },
                    {
                        name: EnteringWaterLogic.NAME,
                        params: { targetWaterHeight: this.heightInWater, jump: this.jumpsIntoWater }
                    },
                    {
                        name: this.attackLogicName || WolfAttackLogic.NAME
                    }
                ]);
            } else {
                return AnimalLogicStep.sequence([
                    AnimalLogicStep.until('DONE',
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
                        params: { targetWaterHeight: this.heightInWater, jump: this.jumpsIntoWater }
                    },
                    {
                        name: this.attackLogicName || WolfAttackLogic.NAME
                    }
                ]);
            }
        } else {
            return { name: this.attackLogicName || WolfAttackLogic.NAME };
        }
    }
}

export abstract class AttackAnimal extends Animal implements AnyAnimal {

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
