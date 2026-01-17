import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig } from './AnimalLogic';
import { AnimalPathStrategy, SteeringParams } from './AnimalPathStrategy';
import { ShoreWalkStrategy } from './ShoreWalkStrategy';

export interface ShoreWalkParams {
    walkDistance: number;
    speed: number;
    nextLogicConfig: AnimalLogicConfig;
}

type ShoreWalkState = 'ROTATING_OUT' | 'WALKING_OUT' | 'ROTATING_IN' | 'WALKING_IN' | 'ROTATING_START';

export class ShoreWalkLogic implements AnimalLogic {
    public static readonly NAME = 'shorewalk';
    public static readonly ANIM_WALK = 'WALK';
    public static readonly ANIM_IDLE = 'IDLE';

    readonly name = ShoreWalkLogic.NAME;

    private strategy: ShoreWalkStrategy;
    private walkDistance: number;
    private speed: number;
    private nextLogicConfig: AnimalLogicConfig;

    private state: ShoreWalkState = 'ROTATING_OUT';
    private startPosition: planck.Vec2 | null = null;
    private startAngle: number = 0;

    constructor(params: ShoreWalkParams) {
        this.strategy = new ShoreWalkStrategy();
        this.walkDistance = params.walkDistance;
        this.speed = params.speed;
        this.nextLogicConfig = params.nextLogicConfig;
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        return true;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        return false;
    }

    activate(context: AnimalLogicContext) {
        this.startPosition = context.originPos.clone();
        this.startAngle = context.physicsBody.getAngle();

        this.strategy.initialize(this.startPosition);
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {

        const currentPos = context.originPos;
        const currentAngle = context.physicsBody.getAngle();
        const angleThreshold = 0.1;

        let isFinished = false;

        // Run State Machine Transitions
        switch (this.state) {
            case 'ROTATING_OUT': {
                // Wait until facing walk direction
                const strategyAngle = this.strategy.calculateWalkAngle(currentPos.y);
                if (Math.abs(this.normalizeAngle(strategyAngle - currentAngle)) < angleThreshold) {
                    this.state = 'WALKING_OUT';
                }
                break;
            }
            case 'WALKING_OUT': {
                // Check if reached destination
                // Strategy target is walkDistance away
                const targetZ = this.startPosition!.y + (this.strategy.walkDirection * this.walkDistance);
                const distToTarget = Math.abs(currentPos.y - targetZ);
                if (distToTarget < 1.0) {
                    this.state = 'ROTATING_IN';
                }
                break;
            }
            case 'ROTATING_IN': {
                // Wait until facing home direction
                const strategyAngle = this.strategy.calculateWalkAngle(currentPos.y);
                const targetAngle = strategyAngle + Math.PI;
                if (Math.abs(this.normalizeAngle(targetAngle - currentAngle)) < angleThreshold) {
                    this.state = 'WALKING_IN';
                }
                break;
            }
            case 'WALKING_IN': {
                // Check if back at start
                const startZ = this.startPosition!.y;
                const distToStart = Math.abs(currentPos.y - startZ);
                if (distToStart < 1.0) {
                    this.state = 'ROTATING_START';
                }
                break;
            }
            case 'ROTATING_START': {
                if (Math.abs(this.normalizeAngle(this.startAngle - currentAngle)) < angleThreshold) {
                    isFinished = true;
                }
                break;
            }
        }

        let targetZ: number = 0;

        // Configure Strategy based on State
        switch (this.state) {
            case 'ROTATING_START':
            case 'ROTATING_OUT':
            case 'ROTATING_IN':
                this.strategy.setSpeed(0);
                targetZ = currentPos.y; // Keep current Z
                break;
            case 'WALKING_OUT':
                targetZ = this.startPosition!.y + (this.strategy.walkDirection * this.walkDistance);
                this.strategy.setSpeed(2.0 * (1 + context.aggressiveness));
                break;
            case 'WALKING_IN':
                targetZ = this.startPosition!.y;
                this.strategy.setSpeed(2.0 * (1 + context.aggressiveness));
                break;
        }

        this.strategy.setTargetZ(targetZ);

        // Get base path from strategy
        const result = this.strategy.update(context);

        // Apply state-specific overrides (Manual Override of Steering)
        if (result.kind === 'STEERING') {
            const steeringData: SteeringParams = result.data;
            if (this.state === 'ROTATING_OUT') {
                steeringData.facing = { angle: Math.PI / 2, normal: steeringData.facing?.normal }; // Face River
            } else if (this.state === 'ROTATING_IN') {
                const bankDir = this.strategy.isOnLeftBank ? -1 : 1;
                steeringData.facing = { angle: Math.PI / 2 + bankDir * Math.PI / 2, normal: steeringData.facing?.normal }; // Face Bank
            } else if (this.state === 'ROTATING_START') {
                steeringData.facing = { angle: this.startAngle, normal: steeringData.facing?.normal };
            }
        }

        return {
            path: result,
            locomotionType: 'LAND',
            animationState: (this.state === 'WALKING_OUT' || this.state === 'WALKING_IN')
                ? ShoreWalkLogic.ANIM_WALK
                : ShoreWalkLogic.ANIM_IDLE,
            nextLogicConfig: isFinished ? this.nextLogicConfig : undefined,
            isFinished
        };
    }

    private normalizeAngle(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
}
