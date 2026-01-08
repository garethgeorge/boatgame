import * as planck from 'planck';
import { Boat } from '../Boat';
import { AnimalWaterAttack } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalLogic, AnimalLogicContext } from './water/AnimalLogic';
import { AnimalLogicRegistry } from './water/AnimalLogicRegistry';

export class AnimalWaterBehavior implements EntityBehavior {
    private entity: AnimalWaterAttack;
    private logic: AnimalLogic;
    private state: 'IDLE' | 'ACTIVE' = 'IDLE';
    private aggressiveness: number;
    private snoutOffset: planck.Vec2;

    constructor(
        entity: AnimalWaterAttack,
        aggressiveness: number,
        logicName: string,
        snoutOffset?: planck.Vec2
    ) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
        this.logic = AnimalLogicRegistry.create(logicName);
        this.snoutOffset = snoutOffset || planck.Vec2(0, 0);
    }

    update(dt: number) {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return;

        const context: AnimalLogicContext = {
            dt,
            originPos: physicsBody.getPosition(),
            snoutPos: physicsBody.getWorldPoint(this.snoutOffset),
            physicsBody,
            targetBody,
            aggressiveness: this.aggressiveness,
            bottles: Boat.getBottleCount()
        };

        switch (this.state) {
            case 'IDLE':
                this.updateIdle(context);
                break;

            case 'ACTIVE':
                this.updateActive(context);
                break;
        }
    }

    private updateIdle(context: AnimalLogicContext) {
        // Shared idle animation
        if (this.entity.waterAttackUpdateIdle) {
            this.entity.waterAttackUpdateIdle(context.dt);
        }

        if (this.logic.shouldActivate(context)) {
            this.state = 'ACTIVE';
        }
    }

    private updateActive(context: AnimalLogicContext) {
        // 1. Check for deactivation
        if (this.logic.shouldDeactivate(context)) {
            this.state = 'IDLE';
            // Stopping logic: drift and damp velocity
            context.physicsBody.setLinearVelocity(context.physicsBody.getLinearVelocity().mul(0.95));
            return;
        }

        // 2. Update logic internal state
        this.logic.update(context);

        // 3. Trigger animations
        if (this.logic.isPreparing()) {
            if (this.entity.waterAttackUpdatePreparing) {
                this.entity.waterAttackUpdatePreparing(context.dt);
            }
        } else {
            if (this.entity.waterAttackUpdateAttacking) {
                this.entity.waterAttackUpdateAttacking(context.dt);
            }
        }

        // 4. Calculate Path
        const result = this.logic.calculatePath(context);

        // 5. Execute Locomotion
        this.executeLocomotion(context, result);
    }

    private executeLocomotion(context: AnimalLogicContext, path: any) {
        const { physicsBody, originPos, dt } = context;
        const { targetWorldPos, desiredSpeed, turningSpeed, turningSmoothing } = path;

        const originToTarget = targetWorldPos.clone().sub(originPos);
        const originToTargetDist = originToTarget.length();

        // --- Rotation ---
        const desiredAngle = Math.atan2(originToTarget.y, originToTarget.x) + Math.PI / 2;
        const currentAngle = physicsBody.getAngle();

        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        if (Math.abs(angleDiff) < 0.01) {
            physicsBody.setAngularVelocity(0.0);
        }

        const taper = Math.min(Math.abs(angleDiff) * 3.0, 1.0);
        const targetRotationSpeed = Math.sign(angleDiff) * turningSpeed * taper;

        const currentRotationSpeed = physicsBody.getAngularVelocity();
        // Smoothing implementation
        const finalRotationSpeed = currentRotationSpeed + (targetRotationSpeed - currentRotationSpeed) * Math.min(1.0, turningSmoothing * dt * 60);
        physicsBody.setAngularVelocity(finalRotationSpeed);

        // --- Movement ---
        const forwardDir = planck.Vec2(Math.sin(currentAngle), -Math.cos(currentAngle));

        // Speed alignment multiplier
        const steerDir = originToTarget.clone();
        if (originToTargetDist > 0.1) steerDir.normalize();
        const alignment = Math.max(0, planck.Vec2.dot(forwardDir, steerDir));

        // Use Snoot to Target distance for arrival slowing if close
        const snoutToTargetDist = planck.Vec2.distance(context.snoutPos, targetWorldPos);

        let targetSpeed = desiredSpeed * alignment;
        if (snoutToTargetDist < 2.0) {
            targetSpeed *= (snoutToTargetDist / 2.0);
        }

        const currentVel = physicsBody.getLinearVelocity();
        const targetVel = forwardDir.mul(targetSpeed);

        const accelSpeed = 5.0; // Acceleration responsiveness
        const nextVel = currentVel.clone().add(targetVel.clone().sub(currentVel).mul(Math.min(1.0, accelSpeed * dt)));

        physicsBody.setLinearVelocity(nextVel);
    }
}
