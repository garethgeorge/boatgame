import * as planck from 'planck';
import { Boat } from '../Boat';
import { AttackAnimalWater } from './AttackAnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AttackAnimalUtils } from './AttackAnimalUtils';

export class AttackAnimalWaterBehavior implements EntityBehavior {
    private entity: AttackAnimalWater;
    private state: 'IDLE' | 'TURNING' | 'ATTACKING' = 'IDLE';
    private aggressiveness: number;

    constructor(entity: AttackAnimalWater, aggressiveness: number) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
    }

    update(dt: number) {
        const bottles = Boat.getBottleCount();
        const speed = AttackAnimalUtils.evaluateAttackSpeed(this.aggressiveness, bottles);
        const startAttackDistance = AttackAnimalUtils.evaluateStartAttackDistance(this.aggressiveness, bottles);
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
        const target = targetBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        // Check if behind the boat
        // V = Forward vector for the boat (local -y)
        const boatForward = targetBody.getWorldVector(planck.Vec2(0, -1));
        // U = Vector from boat to animal
        const boatToAnimal = pos.clone().sub(target);
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
