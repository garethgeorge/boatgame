import * as planck from 'planck';
import { Boat } from '../Boat';
import { AttackAnimalWater } from './AttackAnimal';
import { EntityBehavior } from './EntityBehavior';

export class AnimalSwimAwayBehavior implements EntityBehavior {
    private entity: AttackAnimalWater;
    private state: 'IDLE' | 'FLEEING' = 'IDLE';
    private speed: number;
    private startFleeDistance: number;
    private stopFleeDistance: number;
    private fleeAngle: number = 0;
    private timeSinceLastAngleChange: number = 0;
    private readonly angleChangeInterval: number = 2.0;

    constructor(entity: AttackAnimalWater, aggressiveness: number) {
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
        if (dist > this.stopFleeDistance) {
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

        // Move in the direction of fleeAngle
        // gameAngle 0 -> vector (0, -1)
        // mathAngle = gameAngle - PI/2
        // vector = (cos(mathAngle), sin(mathAngle))
        //        = (cos(gameAngle - PI/2), sin(gameAngle - PI/2))
        //        = (sin(gameAngle), -cos(gameAngle))
        const direction = planck.Vec2(Math.sin(this.fleeAngle), -Math.cos(this.fleeAngle));

        const currentAngle = physicsBody.getAngle();
        const angleDiff = this.calculateAngleDiff(this.fleeAngle, currentAngle);

        // Turn speed
        const rotationSpeed = 0.1 * this.speed;
        physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));

        // Move
        const speed = 12.0 * this.speed; // Flee speed
        const force = direction.mul(speed * physicsBody.getMass());
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
