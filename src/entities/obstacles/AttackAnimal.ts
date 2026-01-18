import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationParameters, AnimationPlayer } from '../../core/AnimationPlayer';
import { AnimalUniversalBehavior } from '../behaviors/AnimalUniversalBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { WolfAttackLogic } from '../behaviors/logic/WolfAttackLogic';
import { EnteringWaterLogic } from '../behaviors/logic/EnteringWaterLogic';
import { ShoreIdleLogic } from '../behaviors/logic/ShoreIdleLogic';
import { AnyAnimal } from '../behaviors/AnimalBehavior';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { AnimalLogic, AnimalLogicConfig, AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { ObstacleHitBehavior, ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { Animal, AnimalPhysicsOptions } from './Animal';

export interface AttackAnimalOptions {
    x: number;
    y: number;
    height: number;
    angle?: number;
    terrainNormal?: THREE.Vector3;
    onShore?: boolean;
    stayOnShore?: boolean;
    aggressiveness?: number;
    attackLogicName?: string;
    attackOffset?: planck.Vec2;
}

export abstract class AttackAnimal extends Animal implements AnyAnimal {
    protected attackLogicName: string | undefined;
    protected attackOffset: planck.Vec2;

    constructor(
        physicsEngine: PhysicsEngine,
        subtype: string,
        options: AttackAnimalOptions,
        physicsOptions: AnimalPhysicsOptions
    ) {
        super();

        const {
            x,
            y,
            height,
            angle = 0,
            terrainNormal,
            onShore = false,
            stayOnShore = false,
        } = options;

        this.attackLogicName = options.attackLogicName;
        this.attackOffset = options.attackOffset || planck.Vec2(0, -physicsOptions.halfLength);
        this.canCausePenalty = true;

        this.setupPhysicsBody(physicsEngine, subtype, Entity.TYPE_OBSTACLE, x, y, -angle, physicsOptions);

        this.setupModelMesh(height);

        if (terrainNormal)
            this.normalVector = terrainNormal.clone();
        else
            this.normalVector = new THREE.Vector3(0, 1, 0);

        const aggressiveness = (options.aggressiveness !== undefined) ? options.aggressiveness : Math.random();
        const logicConfig = this.getLogicConfig(aggressiveness, onShore, stayOnShore);
        if (logicConfig) {
            this.setupBehavior(logicConfig, aggressiveness, this.attackOffset);
        } else {
            this.playAnimation(null, AnimalLogicPhase.NONE);
        }
    }

    // The height for the model when in water
    protected abstract get heightInWater(): number;

    // Does the animal jump into the water?
    protected get jumpsIntoWater(): boolean {
        return false;
    }

    getLogicConfig(aggressiveness: number, onShore: boolean, stayOnShore: boolean): AnimalLogicConfig {
        if (onShore) {
            if (!stayOnShore) {
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

    getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }
}
