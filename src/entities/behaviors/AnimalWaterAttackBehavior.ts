import * as planck from 'planck';
import { Boat } from '../Boat';
import { AnimalWaterAttack } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalAttackParams, AnimalBehaviorUtils } from './AnimalBehaviorUtils';
import { AttackLogic } from './attack/AttackLogic';
import { AttackLogicRegistry } from './attack/AttackLogicRegistry';

export class AnimalWaterAttackBehavior implements EntityBehavior {
    private entity: AnimalWaterAttack;
    private state: 'IDLE' | 'ATTACKING' = 'IDLE';
    private aggressiveness: number;
    private minAttackDistance: number;

    private attackLogic: AttackLogic;
    private attackOffset: planck.Vec2;

    constructor(
        entity: AnimalWaterAttack,
        aggressiveness: number,
        attackLogicName: string = 'wolf',
        attackOffset?: planck.Vec2,
        minAttackDistance: number = 30.0
    ) {
        this.entity = entity;
        //this.aggressiveness = aggressiveness;
        this.aggressiveness = 0;
        this.minAttackDistance = minAttackDistance;
        this.attackLogic = AttackLogicRegistry.create('ambush');
        //this.attackLogic = AttackLogicRegistry.create(attackLogicName);
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

        const attackParams = AnimalBehaviorUtils.evaluateAttackParams(this.aggressiveness, bottles, this.minAttackDistance);
        const originPos = physicsBody.getPosition();
        const targetPos = targetBody.getPosition();
        const attackPos = physicsBody.getWorldPoint(this.attackOffset);

        // State Machine logic - switch only calls update functions
        switch (this.state) {
            case 'IDLE':
                this.updateIdle(dt, targetBody, originPos, targetPos, attackParams);
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
            this.state = 'ATTACKING';
        }
    }

    updateAttacking(dt: number, targetBody: planck.Body, physicsBody: planck.Body,
        originPos: planck.Vec2, attackPos: planck.Vec2, targetPos: planck.Vec2,
        params: AnimalAttackParams) {

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

        // Update logic internal state (timers, current strategy, etc.)
        this.attackLogic.update(dt, originPos, attackPos, physicsBody, targetBody, this.aggressiveness, params);

        // Trigger visual animations based on whether we are preparing or active
        if (this.attackLogic.isPreparing()) {
            if (this.entity.waterAttackUpdatePreparing) {
                this.entity.waterAttackUpdatePreparing(dt);
            }
        } else {
            if (this.entity.waterAttackUpdateAttacking) {
                this.entity.waterAttackUpdateAttacking(dt);
            }
        }

        // 2. Steering: Calculate where to go
        const result = this.attackLogic.calculateTarget(originPos, attackPos, targetBody, params);

        // 3. Locomotion: Move the body
        // If preparing, we just rotate (speed = 0) and damp existing velocity
        if (this.attackLogic.isPreparing()) {
            physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.95));
            this.moveTowardPoint(dt, originPos, attackPos, result.targetWorldPos, 0, physicsBody, params);
        } else {
            this.moveTowardPoint(dt, originPos, attackPos, result.targetWorldPos, result.desiredSpeed, physicsBody, params);
        }
    }

    private moveTowardPoint(dt: number, originPos: planck.Vec2, attackPos: planck.Vec2,
        targetWorldPos: planck.Vec2, desiredSpeed: number, physicsBody: planck.Body,
        params: AnimalAttackParams) {

        // Use vector from origin to target for steering direction.
        // This ensures the animal rotates correctly around its origin to align the snout with the target.
        const originToTarget = targetWorldPos.clone().sub(originPos);
        const originToTargetDist = originToTarget.length();

        // Update facing
        // Target Direction (Angle)
        const desiredAngle = Math.atan2(originToTarget.y, originToTarget.x) + Math.PI / 2;
        this.rotateToward(desiredAngle, physicsBody, params);

        // Forward direction in world space
        const currentAngle = physicsBody.getAngle();
        const forwardDir = planck.Vec2(Math.sin(currentAngle), -Math.cos(currentAngle));

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

        // nextVel = currentVel + (targetVel - currentVel) * accel/dt
        const accelSpeed = 5.0; // Acceleration responsiveness
        const nextVel = currentVel.clone().add(targetVel.clone().sub(currentVel).mul(Math.min(1.0, accelSpeed * dt)));

        physicsBody.setLinearVelocity(nextVel);
    }

    private rotateToward(desiredAngle: number, physicsBody: planck.Body,
        params: AnimalAttackParams) {

        const currentAngle = physicsBody.getAngle();
        const angleDiff = this.angleDifference(currentAngle, desiredAngle);

        // If angle difference is very small, we should stop rotating
        if (Math.abs(angleDiff) < 0.01) {
            physicsBody.setAngularVelocity(0.0);
        }

        // Determine desired angular speed, taper over last few degrees
        const taper = Math.min(Math.abs(angleDiff) * 3.0, 1.0);
        const targetSpeed = Math.sign(angleDiff) * params.turningSpeed * taper;

        // Interpolate with current to smooth
        const currentSpeed = physicsBody.getAngularVelocity();
        const rotationSpeed = currentSpeed + (targetSpeed - currentSpeed) * params.turningSmoothing;

        physicsBody.setAngularVelocity(rotationSpeed);
    }

    private angleDifference(currentAngle: number, desiredAngle: number): number {
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        return angleDiff;
    }
}
