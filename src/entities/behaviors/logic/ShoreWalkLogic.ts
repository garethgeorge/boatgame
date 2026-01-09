import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig } from './AnimalLogic';
import { ShoreWalkStrategy } from './ShoreWalkStrategy';

export interface ShoreWalkParams {
    walkDistance: number;
    speed: number;
    nextLogicConfig: AnimalLogicConfig;
}

type ShoreWalkState = 'ROTATING_OUT' | 'WALKING_OUT' | 'ROTATING_IN' | 'WALKING_IN' | 'ROTATING_START';

export class ShoreWalkLogic implements AnimalLogic {
    public static readonly NAME = 'shorewalk';
    readonly name = ShoreWalkLogic.NAME;

    private strategy: ShoreWalkStrategy;
    private walkDistance: number;
    private speed: number;
    private nextLogicConfig: AnimalLogicConfig;

    private state: ShoreWalkState = 'ROTATING_OUT';
    private startPosition: planck.Vec2 | null = null;
    private startAngle: number = 0;
    private walkAngle: number = 0;
    private targetPosition: planck.Vec2 | null = null;
    private initialized: boolean = false;

    constructor(params: ShoreWalkParams) {
        this.strategy = new ShoreWalkStrategy();
        this.walkDistance = params.walkDistance;
        this.speed = params.speed;
        this.nextLogicConfig = params.nextLogicConfig;
    }

    private ensureInitialized(context: AnimalLogicContext) {
        if (this.initialized) return;

        this.startPosition = context.originPos.clone();
        this.startAngle = context.physicsBody.getAngle();

        this.strategy.initialize(this.startPosition);
        this.walkAngle = this.strategy.calculateWalkAngle(this.startPosition.y);
        this.targetPosition = this.strategy.calculateTargetPosition(this.startPosition.y, this.walkDistance);

        this.initialized = true;
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        return true;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        return false;
    }

    update(context: AnimalLogicContext): void {
        this.ensureInitialized(context);
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        this.ensureInitialized(context);

        const currentPos = context.originPos;
        const currentAngle = context.physicsBody.getAngle();
        const angleThreshold = 0.05;
        const posThreshold = 0.5;

        let desiredSpeed = 0;
        let targetWorldPos = currentPos.clone();
        let desiredAngle = currentAngle;
        let isFinished = false;

        switch (this.state) {
            case 'ROTATING_OUT': {
                desiredAngle = this.walkAngle;
                if (Math.abs(this.normalizeAngle(desiredAngle - currentAngle)) < angleThreshold) {
                    this.state = 'WALKING_OUT';
                }
                break;
            }
            case 'WALKING_OUT': {
                desiredSpeed = 3.0 * this.speed;
                targetWorldPos = this.targetPosition!;
                desiredAngle = this.walkAngle;

                // Enforce bank constraint in the target
                const constrainedX = this.strategy.getConstrainedX(currentPos.y);
                targetWorldPos = planck.Vec2(constrainedX, this.targetPosition!.y);

                if (planck.Vec2.distance(currentPos, this.targetPosition!) < posThreshold) {
                    this.state = 'ROTATING_IN';
                    this.walkAngle = this.normalizeAngle(this.walkAngle + Math.PI);
                }
                break;
            }
            case 'ROTATING_IN': {
                desiredAngle = this.walkAngle;
                if (Math.abs(this.normalizeAngle(desiredAngle - currentAngle)) < angleThreshold) {
                    this.state = 'WALKING_IN';
                }
                break;
            }
            case 'WALKING_IN': {
                desiredSpeed = 3.0 * this.speed;
                targetWorldPos = this.startPosition!;
                desiredAngle = this.walkAngle;

                // Enforce bank constraint in the target
                const constrainedX = this.strategy.getConstrainedX(currentPos.y);
                targetWorldPos = planck.Vec2(constrainedX, this.startPosition!.y);

                if (planck.Vec2.distance(currentPos, this.startPosition!) < posThreshold) {
                    this.state = 'ROTATING_START';
                    desiredAngle = this.startAngle;
                }
                break;
            }
            case 'ROTATING_START': {
                desiredAngle = this.startAngle;
                if (Math.abs(this.normalizeAngle(desiredAngle - currentAngle)) < angleThreshold) {
                    isFinished = true;
                }
                break;
            }
        }

        // Apply terrain height/normal
        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(currentPos.x, currentPos.y);
        const terrainNormal = RiverSystem.getInstance().terrainGeometry.calculateNormal(currentPos.x, currentPos.y);

        return {
            targetWorldPos,
            desiredSpeed,
            desiredAngle,
            locomotionType: 'LAND',
            explicitHeight: terrainHeight,
            explicitNormal: terrainNormal,
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
