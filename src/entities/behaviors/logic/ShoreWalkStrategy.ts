import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalSteering } from './AnimalPathStrategy';

export class ShoreWalkStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreWalk';

    public isOnLeftBank: boolean = true;
    private bankDistance: number = 0;
    private directionSign: number = 1;
    private targetZ: number | null = null;
    private speed: number = 0;

    initialize(originPos: planck.Vec2): void {
        const banks = RiverSystem.getInstance().getBankPositions(originPos.y);
        const distFromLeft = Math.abs(originPos.x - banks.left);
        const distFromRight = Math.abs(originPos.x - banks.right);

        if (distFromLeft < distFromRight) {
            this.isOnLeftBank = true;
            this.bankDistance = distFromLeft;
        } else {
            this.isOnLeftBank = false;
            this.bankDistance = distFromRight;
        }

        // Randomly choose to walk upstream or downstream
        this.directionSign = Math.random() < 0.5 ? 1 : -1;
    }

    setTargetZ(z: number): void {
        this.targetZ = z;
    }

    setSpeed(speed: number): void {
        this.speed = speed;
    }

    public get walkDirection(): number {
        return this.directionSign;
    }

    calculateWalkAngle(z: number): number {
        const dxdz = RiverSystem.getInstance().getRiverDerivative(z);
        // Tangent vector is (dx/dz, 1) if walking downstream (positive z)
        // Correctly maps to the world rotation required by Entity.sync
        return Math.atan2(1.0 * this.directionSign, dxdz * this.directionSign) + Math.PI / 2;
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const currentPos = context.originPos;

        // Default to not moving if no target
        if (this.targetZ === null) {
            return {
                kind: 'STEERING',
                data: {
                    target: currentPos,
                    speed: 0
                }
            };
        }

        const targetX = this.getConstrainedX(this.targetZ);
        const targetWorldPos = planck.Vec2(targetX, this.targetZ);

        // Calculate rotation based on river flow derivative
        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(currentPos.x, currentPos.y);
        const terrainNormal = RiverSystem.getInstance().terrainGeometry.calculateNormal(currentPos.x, currentPos.y);
        const desiredAngle = this.calculateWalkAngle(currentPos.y);

        return {
            kind: 'STEERING',
            data: {
                target: targetWorldPos,
                speed: this.speed,
                height: terrainHeight,
                facing: {
                    angle: desiredAngle,
                    normal: terrainNormal
                }
            }
        };
    }

    getConstrainedX(z: number): number {
        const banks = RiverSystem.getInstance().getBankPositions(z);
        return this.isOnLeftBank
            ? banks.left - this.bankDistance
            : banks.right + this.bankDistance;
    }
}
