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

    private lastPosition: planck.Vec2 | null = null;
    private accumulatedDistance: number = 0;

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

        // Initial target is just a small step in the walk direction
        const stepZ = this.startPosition.y + (this.strategy.walkDirection * 2.0);
        const targetX = this.strategy.getConstrainedX(stepZ);
        this.targetPosition = planck.Vec2(targetX, stepZ);

        this.lastPosition = context.originPos.clone();
        this.accumulatedDistance = 0;

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
        const angleThreshold = 0.1;
        const posThreshold = 0.5;

        // Track distance
        if (this.lastPosition && (this.state === 'WALKING_OUT' || this.state === 'WALKING_IN')) {
            this.accumulatedDistance += planck.Vec2.distance(currentPos, this.lastPosition);
        }
        this.lastPosition = currentPos.clone();

        let desiredSpeed = 0;
        let targetWorldPos = currentPos.clone();
        let desiredAngle = currentAngle;
        let isFinished = false;

        switch (this.state) {
            case 'ROTATING_OUT': {
                desiredAngle = this.strategy.calculateWalkAngle(currentPos.y);
                if (Math.abs(this.normalizeAngle(desiredAngle - currentAngle)) < angleThreshold) {
                    this.state = 'WALKING_OUT';
                    this.accumulatedDistance = 0;
                }
                break;
            }
            case 'WALKING_OUT': {
                desiredSpeed = 3.0 * this.speed;
                desiredAngle = this.strategy.calculateWalkAngle(currentPos.y);

                // Set target a bit ahead of current Z
                const stepAhead = 2.0;
                const nextZ = currentPos.y + (this.strategy.walkDirection * stepAhead);
                const nextX = this.strategy.getConstrainedX(nextZ);
                targetWorldPos = planck.Vec2(nextX, nextZ);

                if (this.accumulatedDistance >= this.walkDistance) {
                    this.state = 'ROTATING_IN';
                    this.accumulatedDistance = 0;
                }
                break;
            }
            case 'ROTATING_IN': {
                // Rotate to face back towards start
                desiredAngle = this.strategy.calculateWalkAngle(currentPos.y) + Math.PI;
                if (Math.abs(this.normalizeAngle(desiredAngle - currentAngle)) < angleThreshold) {
                    this.state = 'WALKING_IN';
                }
                break;
            }
            case 'WALKING_IN': {
                desiredSpeed = 3.0 * this.speed;
                // Face back towards start
                desiredAngle = this.strategy.calculateWalkAngle(currentPos.y) + Math.PI;

                // Set target a bit ahead towards start Z
                const stepAhead = 2.0;
                const nextZ = currentPos.y - (this.strategy.walkDirection * stepAhead);
                const nextX = this.strategy.getConstrainedX(nextZ);
                targetWorldPos = planck.Vec2(nextX, nextZ);

                // Check if we've reached the start Z (with a small buffer)
                const startZ = this.startPosition!.y;
                const directionSign = this.strategy.walkDirection;
                const hasReachedStart = directionSign > 0 ? (currentPos.y <= startZ + 0.5) : (currentPos.y >= startZ - 0.5);

                if (hasReachedStart) {
                    this.state = 'ROTATING_START';
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
