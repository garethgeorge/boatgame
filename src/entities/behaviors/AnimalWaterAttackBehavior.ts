import * as planck from 'planck';
import { Boat } from '../Boat';
import { AnimalWaterAttack } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalAttackParams, AnimalBehaviorUtils } from './AnimalBehaviorUtils';
import { AttackLogic } from './attack/AttackLogic';
import { AttackLogicRegistry } from './attack/AttackLogicRegistry';

export class AnimalWaterAttackBehavior implements EntityBehavior {
    private entity: AnimalWaterAttack;
    private state: 'IDLE' | 'TURNING' | 'ATTACKING' = 'IDLE';
    private aggressiveness: number;

    private attackLogic: AttackLogic;
    private attackOffset: planck.Vec2;

    constructor(entity: AnimalWaterAttack, aggressiveness: number, attackLogicName: string = 'wolf', attackOffset?: planck.Vec2) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
        this.attackLogic = AttackLogicRegistry.create(attackLogicName);
        this.attackOffset = attackOffset || planck.Vec2(0, 0);
    }

    update(dt: number) {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return;

        const bottles = Boat.getBottleCount();
        if (bottles <= 0) {
            this.handleNoBottles(dt, physicsBody);
            return;
        }

        const attackParams = AnimalBehaviorUtils.evaluateAttackParams(this.aggressiveness, bottles);
        const originPos = physicsBody.getPosition();
        const targetPos = targetBody.getPosition();
        const attackPos = physicsBody.getWorldPoint(this.attackOffset);

        // State Machine logic - switch only calls update functions
        switch (this.state) {
            case 'IDLE':
                this.updateIdle(dt, targetBody, originPos, targetPos, attackParams);
                break;

            case 'TURNING':
                this.updateTurning(dt, targetBody, physicsBody, originPos, attackPos, targetPos, attackParams);
                break;

            case 'ATTACKING':
                this.updateAttacking(dt, targetBody, physicsBody, originPos, attackPos, targetPos, attackParams);
                break;
        }
    }

    private handleNoBottles(dt: number, physicsBody: planck.Body) {
        if (this.entity.waterAttackUpdateIdle) {
            this.entity.waterAttackUpdateIdle(dt);
        }
        this.state = 'IDLE';
        physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.95)); // Just drift
    }

    private updateIdle(dt: number, targetBody: planck.Body, originPos: planck.Vec2, targetPos: planck.Vec2, params: AnimalAttackParams) {
        if (this.entity.waterAttackUpdateIdle) {
            this.entity.waterAttackUpdateIdle(dt);
        }

        const localPos = targetBody.getLocalPoint(originPos);
        if (localPos.y > Boat.STERN_Y) return;

        const distToBoat = planck.Vec2.distance(originPos, targetPos);
        if (distToBoat < params.startAttackDistance) {
            this.state = 'TURNING';
        }
    }

    private updateTurning(dt: number, targetBody: planck.Body, physicsBody: planck.Body,
        originPos: planck.Vec2, attackPos: planck.Vec2, targetPos: planck.Vec2, params: AnimalAttackParams) {

        if (this.entity.waterAttackUpdatePreparing) {
            this.entity.waterAttackUpdatePreparing(dt);
        }

        const distToBoat = planck.Vec2.distance(originPos, targetPos);
        if (distToBoat > params.endAttackDistance) {
            this.state = 'IDLE';
            return;
        }

        // Just turn to face the boat center initially to get oriented
        const diffToBoat = targetBody.getPosition().clone().sub(originPos);

        // Slow down movement while turning
        if (distToBoat > 10) {
            physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.95));
        }

        const currentAngle = physicsBody.getAngle();
        const desiredAngle = Math.atan2(diffToBoat.y, diffToBoat.x) + Math.PI / 2;
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const turnSpeed = params.turningSpeed;
        const nextAngle = currentAngle + angleDiff * Math.min(1.0, turnSpeed * dt);
        physicsBody.setAngle(nextAngle);

        // Transition to attacking once roughly facing boat
        if (Math.abs(angleDiff) < 0.45) { // ~25 degrees
            this.state = 'ATTACKING';
        }
    }

    updateAttacking(dt: number, targetBody: planck.Body, physicsBody: planck.Body,
        originPos: planck.Vec2, attackPos: planck.Vec2, targetPos: planck.Vec2,
        params: AnimalAttackParams) {
        if (this.entity.waterAttackUpdateAttacking) {
            this.entity.waterAttackUpdateAttacking(dt);
        }

        const distToBoat = planck.Vec2.distance(originPos, targetPos);
        if (distToBoat > params.endAttackDistance) {
            this.state = 'IDLE';
            return;
        }

        // 1. Decision: Should we continue the attack?
        if (this.attackLogic.shouldAbort(originPos, attackPos, targetBody, params)) {
            this.state = 'IDLE';
            return;
        }

        // Update logic timers/state
        this.attackLogic.update(dt, originPos, attackPos, targetBody, this.aggressiveness);

        // 2. Steering: Calculate where to go
        // Predict the target point based on strategy
        const result = this.attackLogic.calculateTarget(originPos, attackPos, targetBody, params);

        // 3. Locomotion: Move the body
        this.moveTowardPoint(dt, originPos, attackPos, result.targetWorldPos, result.desiredSpeed, physicsBody, params);
    }


    private moveTowardPoint(dt: number, originPos: planck.Vec2, attackPos: planck.Vec2,
        targetWorldPos: planck.Vec2, desiredSpeed: number, physicsBody: planck.Body, params: AnimalAttackParams) {

        // Use vector from origin to target for steering direction.
        // This ensures the animal rotates correctly around its origin to align the snout with the target.
        const originToTarget = targetWorldPos.clone().sub(originPos);
        const originToTargetDist = originToTarget.length();

        // Target Direction (Angle)
        const desiredAngle = Math.atan2(originToTarget.y, originToTarget.x) + Math.PI / 2;

        // Smoothly interpolate angle
        const currentAngle = physicsBody.getAngle();
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // Turn speed depends on difficulty/aggressiveness
        const turnSpeed = params.turningSpeed;
        const nextAngle = currentAngle + angleDiff * Math.min(1.0, turnSpeed * dt);
        physicsBody.setAngle(nextAngle);

        // Forward direction in world space
        const forwardDir = planck.Vec2(Math.sin(nextAngle), -Math.cos(nextAngle));

        // Alignment multiplier scaling speed by how well origin/snout is pointed at target
        const steerDir = originToTarget.clone();
        if (originToTargetDist > 0.1) steerDir.normalize();
        const alignment = Math.max(0, planck.Vec2.dot(forwardDir, steerDir));

        // Use Snoot to Target distance for arrival slowing if close
        const snoutToTargetDist = planck.Vec2.distance(attackPos, targetWorldPos);

        // Maintain speed, but slow down for sharp turns or if poorly aligned.
        // Also slow down if snout is very close to target to prevent overshooting jitter.
        let targetSpeed = desiredSpeed * alignment;
        if (snoutToTargetDist < 2.0) {
            targetSpeed *= (snoutToTargetDist / 2.0);
        }

        // Smoothed velocity interpolation
        const currentVel = physicsBody.getLinearVelocity();
        const targetVel = forwardDir.mul(targetSpeed);

        const accelSpeed = 5.0; // Acceleration responsiveness
        const nextVel = currentVel.clone().add(targetVel.clone().sub(currentVel).mul(Math.min(1.0, accelSpeed * dt)));

        physicsBody.setLinearVelocity(nextVel);
        physicsBody.setAngularVelocity(0); // No physics-based rotation
    }
}
