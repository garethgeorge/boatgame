import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalStrategyContext } from './AnimalPathStrategy';

export class ShoreWalkStrategy {
    private isOnLeftBank: boolean = true;
    private bankDistance: number = 0;
    private directionSign: number = 1;

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

    calculateWalkAngle(z: number): number {
        const dxdz = RiverSystem.getInstance().getRiverDerivative(z);
        // Tangent vector is (dx/dz, 1)
        return Math.atan2(1.0 * this.directionSign, dxdz * this.directionSign) + Math.PI / 2;
    }

    calculateTargetPosition(currentZ: number, targetDistance: number): planck.Vec2 {
        const targetZ = currentZ + this.directionSign * targetDistance;
        const targetBanks = RiverSystem.getInstance().getBankPositions(targetZ);
        const targetX = this.isOnLeftBank
            ? targetBanks.left - this.bankDistance
            : targetBanks.right + this.bankDistance;

        return planck.Vec2(targetX, targetZ);
    }

    getConstrainedX(z: number): number {
        const banks = RiverSystem.getInstance().getBankPositions(z);
        return this.isOnLeftBank
            ? banks.left - this.bankDistance
            : banks.right + this.bankDistance;
    }
}
