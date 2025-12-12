import * as planck from 'planck';
import { Boat } from '../Boat';
import { AttackAnimalWater } from './AttackAnimal';
import { EntityBehavior } from './EntityBehavior';

export class AttackAnimalWaterBehavior implements EntityBehavior {
    private entity: AttackAnimalWater;
    private state: 'IDLE' | 'TURNING' | 'ATTACKING' = 'IDLE';
    private speed: number;
    private startAttackDistance: number;
    private stopAttackDistance: number;

    constructor(entity: AttackAnimalWater, aggressiveness: number) {
        this.entity = entity;
        this.speed = 1 + 3 * aggressiveness;
        this.startAttackDistance = 30 + 60 * aggressiveness;
        this.stopAttackDistance = this.startAttackDistance + 20;
    }

    update(dt: number) {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return;

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
                this.updateIdle(dist);
                break;
            case 'TURNING':
                this.updateTurning(dist, diff, physicsBody, isBehind);
                break;
            case 'ATTACKING':
                this.updateAttacking(dist, diff, physicsBody, isBehind);
                break;
        }
    }

    private updateIdle(dist: number) {
        if (dist < this.startAttackDistance) {
            this.state = 'TURNING';
        }
    }

    private updateTurning(dist: number, diff: planck.Vec2, physicsBody: planck.Body, isBehind: boolean) {
        if (dist > this.stopAttackDistance) {
            this.state = 'IDLE';
            return;
        }

        const angleDiff = this.calculateAngleToTarget(diff, physicsBody.getAngle());

        // Rotate towards target
        const rotationSpeed = 0.05 * this.speed; // Very slow turn
        physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));

        // Drag to stop movement while turning
        physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.9));

        // Check if facing target (within ~15 degrees = 0.26 rad)
        // And ensure we are not behind the boat
        if (Math.abs(angleDiff) < 0.26 && !isBehind) {
            this.state = 'ATTACKING';
        }
    }

    private updateAttacking(dist: number, diff: planck.Vec2, physicsBody: planck.Body, isBehind: boolean) {
        if (dist > this.stopAttackDistance) {
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
        const speed = 12.0 * this.speed; // Faster drift
        const force = diff.mul(speed * physicsBody.getMass());
        physicsBody.applyForceToCenter(force);

        // Continue rotating to track
        const rotationSpeed = 0.05 * this.speed;
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
