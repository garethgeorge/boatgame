import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { WolfAttackLogic } from '../behaviors/logic/WolfAttackLogic';
import { EnteringWaterLogic } from '../behaviors/logic/EnteringWaterLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalLogicOrchestrator, AnimalOptions, AnimalPhysicsOptions } from './Animal';

export interface AttackAnimalOptions extends AnimalOptions {
    onShore?: boolean;
    stayOnShore?: boolean;
    attackLogicName?: string;
}

export class AttackLogicOrchestrator implements AnimalLogicOrchestrator {
    private attackLogicName: string;
    private heightInWater: number;
    private jumpsIntoWater: boolean;
    private onShore: boolean;
    private stayOnShore: boolean;

    constructor(
        params: {
            attackLogicName: string,
            heightInWater: number,
            jumpsIntoWater?: boolean,
            onShore?: boolean,
            stayOnShore?: boolean
        }
    ) {
        this.attackLogicName = params.attackLogicName;
        this.heightInWater = params.heightInWater;
        this.jumpsIntoWater = params.jumpsIntoWater ?? false;
        this.onShore = params.onShore ?? false;
        this.stayOnShore = params.stayOnShore ?? false;
    }

    getSnoutOffset(halfLength: number): planck.Vec2 {
        // assume snout is on -y axis
        return planck.Vec2(0, -halfLength);
    }

    getLogicConfig(): AnimalLogicConfig {
        if (this.onShore) {
            if (!this.stayOnShore) {
                return this.getOnShoreConfig();
            } else {
                return null;
            }
        } else {
            return this.getInWaterConfig();
        }
    }

    getOnShoreConfig(): AnimalLogicConfig {
        const idleConfig: AnimalLogicConfig = {
            name: ShoreIdleLogic.NAME,
            params: {
                nextLogicConfig: this.getEnterWaterConfig(),
                maybeSwitchBehavior: () => this.shoreIdleMaybeSwitchBehavior()
            }
        };
        return idleConfig;
    }

    getEnterWaterConfig(): AnimalLogicConfig {
        // Create an entering water logic that chains into the final attack/flight logic
        return {
            name: EnteringWaterLogic.NAME,
            params: {
                targetWaterHeight: this.heightInWater,
                jump: this.jumpsIntoWater,
                nextLogicConfig: this.getInWaterConfig()
            }
        };
    }

    getInWaterConfig(): AnimalLogicConfig {
        return { name: this.attackLogicName || WolfAttackLogic.NAME };
    }

    /**
     * Can be overriden in derived classes to change behavior while
     * idle.
     */
    shoreIdleMaybeSwitchBehavior(): AnimalLogicConfig | null {
        return null; // Default: stay in idle
    }
}

export abstract class AttackAnimal extends Animal implements AnyAnimal {

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
