import * as planck from 'planck';
import { RiverSystem } from '../../world/RiverSystem';
import { AnimalShoreWalk } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';

export class AnimalShoreWalkBehavior implements EntityBehavior {
    private entity: AnimalShoreWalk;
    private walkDistance: number;
    private speed: number;
    private rotationSpeed: number = 3.0; // radians per second

    // The walking goals
    private walkStartPosition: planck.Vec2 | null = null;
    private walkStartAngle: number = 0;
    private walkAngle: number = 0;

    // Bank tracking - which bank and how far from it
    private isOnLeftBank: boolean = true;
    private bankDistance: number = 0;

    // The walking state
    private state: 'outbound' | 'inbound' | 'finishing' | 'finished' = 'outbound';
    private targetAngle: number = 0;
    private targetPosition: planck.Vec2 | null = null;

    constructor(
        entity: AnimalShoreWalk,
        walkDistance: number,
        speed: number
    ) {
        this.entity = entity;
        this.walkDistance = walkDistance;
        this.speed = speed;

        const physicsBody = entity.getPhysicsBody();
        if (!physicsBody) {
            return;
        }

        // Store starting position and angle
        this.walkStartPosition = physicsBody.getPosition().clone();
        this.walkStartAngle = physicsBody.getAngle();

        // Determine which bank we're on and how far from it
        const startZ = this.walkStartPosition.y;
        const startX = this.walkStartPosition.x;
        const banks = RiverSystem.getInstance().getBankPositions(startZ);

        const distFromLeft = Math.abs(startX - banks.left);
        const distFromRight = Math.abs(startX - banks.right);

        if (distFromLeft < distFromRight) {
            this.isOnLeftBank = true;
            this.bankDistance = distFromLeft;
        } else {
            this.isOnLeftBank = false;
            this.bankDistance = distFromRight;
        }

        // Calculate direction parallel to water using river derivative
        // getRiverDerivative gives us dx/dz for the river at this z position
        const dxdz = RiverSystem.getInstance().getRiverDerivative(startZ);

        // The tangent vector to the river is (dx/dz, 1) in world coordinates (x, z)
        // In planck coordinates this is (dx/dz, 1) for (x, y)
        const tangentX = dxdz;
        const tangentY = 1.0;

        // Randomly choose to walk upstream or downstream
        const directionSign = Math.random() < 0.5 ? 1 : -1;
        this.walkAngle = Math.atan2(tangentY * directionSign, tangentX * directionSign) + Math.PI / 2;

        // Calculate target position maintaining bank distance
        const targetZ = startZ + directionSign * this.walkDistance;
        const targetBanks = RiverSystem.getInstance().getBankPositions(targetZ);
        const targetX = this.isOnLeftBank
            ? targetBanks.left - this.bankDistance
            : targetBanks.right + this.bankDistance;

        // Set outbound target angle and position
        this.targetAngle = this.walkAngle;
        this.targetPosition = planck.Vec2(targetX, targetZ);

        // Switch to kinematic for precise path control
        physicsBody.setType(planck.Body.KINEMATIC);
    }

    update(dt: number) {
        const physicsBody = this.entity.getPhysicsBody();
        if (!physicsBody) return;

        if (this.state === 'finished') return;

        const currentAngle = physicsBody.getAngle();
        const currentPos = physicsBody.getPosition();

        // Step 1: Check if we need to rotate to target angle
        const angleDiff = this.normalizeAngle(this.targetAngle - currentAngle);
        const angleThreshold = 0.05; // Small threshold to avoid oscillation

        if (Math.abs(angleDiff) > angleThreshold) {
            // Rotate towards target angle
            const maxRotation = this.rotationSpeed * (1 / 60); // Assuming 60 FPS
            const rotation = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxRotation);
            physicsBody.setAngle(currentAngle + rotation);

            // Stop linear movement while rotating
            physicsBody.setLinearVelocity(planck.Vec2(0, 0));
            physicsBody.setAngularVelocity(0);

            // Update terrain position
            const height = RiverSystem.getInstance().terrainGeometry.calculateHeight(currentPos.x, currentPos.y);
            const normal = RiverSystem.getInstance().terrainGeometry.calculateNormal(currentPos.x, currentPos.y);
            this.entity.setLandPosition(height, normal, 0);
            return;
        }

        // Step 2: Check if we need to move to target position
        const posDiff = this.targetPosition.clone().sub(currentPos);
        const posDiffLength = posDiff.length();
        const positionThreshold = 0.5;

        if (posDiffLength > positionThreshold) {
            // Move towards target position
            const moveSpeed = 3.0 * this.speed;
            const velocity = posDiff.clone().mul(moveSpeed / posDiffLength);
            physicsBody.setLinearVelocity(velocity);
            physicsBody.setAngularVelocity(0);

            // Enforce bank distance constraint
            const currentZ = currentPos.y;
            const banks = RiverSystem.getInstance().getBankPositions(currentZ);
            const constrainedX = this.isOnLeftBank
                ? banks.left - this.bankDistance
                : banks.right + this.bankDistance;

            // Update position with constrained x
            physicsBody.setPosition(planck.Vec2(constrainedX, currentPos.y));

            // Update terrain position
            const height = RiverSystem.getInstance().terrainGeometry.calculateHeight(constrainedX, currentZ);
            const normal = RiverSystem.getInstance().terrainGeometry.calculateNormal(constrainedX, currentZ);
            this.entity.setLandPosition(height, normal, 0);
            return;
        }

        // Step 3: We've arrived at target angle and position - update targets based on state
        // Stop movement first
        physicsBody.setLinearVelocity(planck.Vec2(0, 0));
        physicsBody.setAngularVelocity(0);

        if (this.state === 'outbound') {
            // Turn around and head back
            this.state = 'inbound';
            this.targetAngle = this.normalizeAngle(this.walkAngle + Math.PI);
            this.targetPosition = this.walkStartPosition.clone();
        } else if (this.state === 'inbound') {
            // Arrived back at start, now rotate to initial angle
            this.state = 'finishing';
            this.targetAngle = this.walkStartAngle;
            // Position is already at start, no need to change it
        } else if (this.state === 'finishing') {
            // All done - restore to initial state
            this.state = 'finished';
            physicsBody.setType(planck.Body.DYNAMIC);
            this.entity.shoreWalkDidComplete?.();
        }
    }

    // Normalize angle to [-PI, PI]
    private normalizeAngle(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
}
