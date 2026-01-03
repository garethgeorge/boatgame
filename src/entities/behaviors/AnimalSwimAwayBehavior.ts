import * as planck from 'planck';
import { Boat } from '../Boat';
import { AnimalWaterAttack } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';

export class AnimalSwimAwayBehavior implements EntityBehavior {
    private entity: AnimalWaterAttack;
    private state: 'IDLE' | 'FLEEING' = 'IDLE';
    private speed: number;
    private startFleeDistance: number;
    private stopFleeDistance: number;
    private fleeAngle: number = 0;
    private timeSinceLastAngleChange: number = 0;
    private readonly angleChangeInterval: number = 2.0;

    constructor(entity: AnimalWaterAttack, aggressiveness: number) {
        this.entity = entity;
        this.speed = 1 + 3 * aggressiveness;
        this.startFleeDistance = 20 + 40 * aggressiveness;
        this.stopFleeDistance = this.startFleeDistance + 30;
    }

    update(dt: number) {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return;

        const pos = physicsBody.getPosition();
        const target = targetBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        switch (this.state) {
            case 'IDLE':
                if (dist < this.startFleeDistance) {
                    this.startFleeing(targetBody);
                }
                break;
            case 'FLEEING':
                this.updateFleeing(dt, physicsBody, targetBody, dist);
                break;
        }
    }

    private startFleeing(targetBody: planck.Body) {
        this.state = 'FLEEING';
        this.pickNewFleeAngle(targetBody);
        this.timeSinceLastAngleChange = 0;
    }

    private updateFleeing(dt: number, physicsBody: planck.Body, targetBody: planck.Body, dist: number) {
        const boatVel = targetBody.getLinearVelocity();
        const boatToAnimal = physicsBody.getPosition().clone().sub(targetBody.getPosition());

        // Stop if far away OR boat is not moving towards animal
        // "Stop ... if the angle between the boats direction of motion and the vector from the boat to the animal is greater than 90 degrees."
        // This corresponds to dot product < 0.
        // Also if boat is not moving, it's not travelling towards it.
        const isMoving = boatVel.lengthSquared() > 0.5;
        const isMovingTowards = isMoving && planck.Vec2.dot(boatVel, boatToAnimal) > 0;

        if (dist > this.stopFleeDistance || !isMovingTowards) {
            this.state = 'IDLE';
            // Slow down when stopping
            physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.9));
            return;
        }

        this.timeSinceLastAngleChange += dt;
        if (this.timeSinceLastAngleChange > this.angleChangeInterval) {
            this.pickNewFleeAngle(targetBody);
            this.timeSinceLastAngleChange = 0;
        }

        const currentAngle = physicsBody.getAngle();
        const angleDiff = this.calculateAngleDiff(this.fleeAngle, currentAngle);

        // Turn towards target
        // rate depends on speed which depends on aggressiveness
        const rotationSpeed = 0.05 * this.speed;
        physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));

        // Move forward in current facing direction
        const forwardDir = planck.Vec2(Math.sin(currentAngle), -Math.cos(currentAngle));

        const speed = 12.0 * this.speed; // Flee speed
        const force = forwardDir.mul(speed * physicsBody.getMass());
        physicsBody.applyForceToCenter(force);
    }

    private pickNewFleeAngle(targetBody: planck.Body) {
        // "direction the boat is moving"
        const vel = targetBody.getLinearVelocity();
        let boatAngle = targetBody.getAngle();

        if (vel.length() > 0.5) {
            // Calculate angle from velocity
            // mathAngle = atan2(vy, vx)
            // gameAngle = mathAngle + PI/2
            boatAngle = Math.atan2(vel.y, vel.x) + Math.PI / 2;
        }

        // "randomly selected angle relative to the direction"
        // Let's vary by +/- 30 degrees (PI/6)
        const variance = (Math.random() - 0.5) * Math.PI / 6;
        this.fleeAngle = boatAngle + variance;
    }

    private calculateAngleDiff(desiredAngle: number, currentAngle: number): number {
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        return angleDiff;
    }
}
