import * as planck from 'planck';
import { Boat } from '../Boat';
import { AnimalWaterAttack } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalBehaviorUtils } from './AnimalBehaviorUtils';

export class AnimalWaterAttackBehavior implements EntityBehavior {
    private entity: AnimalWaterAttack;
    private state: 'IDLE' | 'TURNING' | 'ATTACKING' = 'IDLE';
    private aggressiveness: number;

    constructor(entity: AnimalWaterAttack, aggressiveness: number) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
    }

    update(dt: number) {
        const bottles = Boat.getBottleCount();
        const speed = AnimalBehaviorUtils.evaluateAttackSpeed(this.aggressiveness, bottles);
        const startAttackDistance = AnimalBehaviorUtils.evaluateStartAttackDistance(this.aggressiveness, bottles);
        const stopAttackDistance = startAttackDistance > 0 ? startAttackDistance + 20 : 0;

        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return;

        // If no speed (no bottles), animal is effectively disabled from attacking
        if (speed <= 0) {
            if (this.entity.waterAttackUpdateIdle) {
                this.entity.waterAttackUpdateIdle(dt);
            }
            this.state = 'IDLE';
            physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.95)); // Just drift
            return;
        }

        const pos = physicsBody.getPosition();
        const targetPos = targetBody.getPosition();
        const playerVel = targetBody.getLinearVelocity();

        const realDiff = targetPos.clone().sub(pos);
        const dist = realDiff.length(); // Use real distance for state transitions

        // Calculate intercept
        // Estimate time to reach target
        const averageAttackSpeed = 12.0 * speed; // Should match force multiplier in updateAttacking
        let timeToIntercept = 0;
        if (averageAttackSpeed > 0) {
            timeToIntercept = dist / averageAttackSpeed;
            // Clamp prediction to max 2 seconds to avoid crazy behavior
            timeToIntercept = Math.min(timeToIntercept, 2.0);

            // Dampen the intercept prediction to keep it closer to the boat
            timeToIntercept *= 0.7;
        }

        const predictedPos = targetPos.clone().add(playerVel.clone().mul(timeToIntercept));

        // Blend between direct pursuit and intercept based on distance
        // Dist < 8: 0 (Direct)
        // Dist > 40: 1 (Intercept)
        // This biases heavily towards direct pursuit when "remotely close"
        let predictionWeight = (dist - 8.0) / (40.0 - 8.0);
        predictionWeight = Math.max(0, Math.min(1, predictionWeight));

        const blendedTarget = planck.Vec2.combine(1 - predictionWeight, targetPos, predictionWeight, predictedPos);
        const diff = blendedTarget.sub(pos); // Use blended diff for steering

        // Check if behind the boat
        // V = Forward vector for the boat (local -y)
        const boatForward = targetBody.getWorldVector(planck.Vec2(0, -1));
        // U = Vector from boat to animal
        const boatToAnimal = pos.clone().sub(targetPos);
        // Dot positive = in front, negative = behind
        const isBehind = planck.Vec2.dot(boatToAnimal, boatForward) < 0;

        switch (this.state) {
            case 'IDLE':
                this.updateIdle(dt, dist, startAttackDistance);
                break;
            case 'TURNING':
                this.updateTurning(dt, dist, diff, physicsBody, isBehind, stopAttackDistance, speed);
                break;
            case 'ATTACKING':
                this.updateAttacking(dt, dist, diff, physicsBody, isBehind, stopAttackDistance, speed);
                break;
        }
    }

    private updateIdle(dt: number, dist: number, startAttackDistance: number) {
        if (this.entity.waterAttackUpdateIdle) {
            this.entity.waterAttackUpdateIdle(dt);
        }

        if (dist < startAttackDistance) {
            this.state = 'TURNING';
        }
    }

    private updateTurning(dt: number, dist: number, diff: planck.Vec2, physicsBody: planck.Body, isBehind: boolean, stopAttackDistance: number, speed: number) {
        if (this.entity.waterAttackUpdatePreparing) {
            this.entity.waterAttackUpdatePreparing(dt);
        }

        if (dist > stopAttackDistance) {
            this.state = 'IDLE';
            return;
        }

        const angleDiff = this.calculateAngleToTarget(diff, physicsBody.getAngle());

        // Rotate towards target
        const rotationSpeed = 0.05 * speed; // Very slow turn
        physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));

        // Drag to stop movement while turning
        physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.9));

        // Check if facing target (within ~15 degrees = 0.26 rad)
        // And ensure we are not behind the boat
        if (Math.abs(angleDiff) < 0.26 && !isBehind) {
            this.state = 'ATTACKING';
        }
    }

    private updateAttacking(dt: number, dist: number, diff: planck.Vec2, physicsBody: planck.Body, isBehind: boolean, stopAttackDistance: number, speed: number) {
        if (this.entity.waterAttackUpdateAttacking) {
            this.entity.waterAttackUpdateAttacking(dt);
        }

        if (dist > stopAttackDistance) {
            this.state = 'IDLE';
            return;
        }

        if (isBehind) {
            this.state = 'TURNING';
            return;
        }

        const angleDiff = this.calculateAngleToTarget(diff, physicsBody.getAngle());

        diff.normalize();
        // Move towards target
        const attackForce = 12.0 * speed; // Faster drift
        const force = diff.mul(attackForce * physicsBody.getMass());
        physicsBody.applyForceToCenter(force);

        // Continue rotating to track
        const rotationSpeed = 0.05 * speed;
        physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));
    }

    private calculateAngleToTarget(diff: planck.Vec2, currentAngle: number): number {
        const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        return angleDiff;
    }
}
