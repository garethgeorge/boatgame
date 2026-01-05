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

        // 1. Determine Local Position of Animal relative to Boat
        const localPos = targetBody.getLocalPoint(pos);

        // 2. Select Local Target Point
        // Boat is approx 2.4 wide (-1.2 to 1.2), 6 long (-3.0 to 3.0).
        // +Y is Stern (Back), -Y is Bow (Front).
        // Danger zone (Bow) is y < Boat.FRONT_ZONE_END_Y.
        // We target a point in the target zone (Stern).
        const sternLocalY = Boat.STERN_Y * 0.5; // Halfway to stern tip
        let chosenTargetLocal: planck.Vec2;

        if (localPos.y < Boat.FRONT_ZONE_END_Y) {
            // Animal is in front of the boat. Flank!
            // Head towards a staging point to the side of the stern.
            const side = localPos.x > 0 ? 1 : -1;
            chosenTargetLocal = planck.Vec2(side * Boat.WIDTH * 2.5, sternLocalY);
        } else {
            // Animal is alongside or behind the danger zone. Go for the back.
            chosenTargetLocal = planck.Vec2(0, sternLocalY);
        }

        // 3. Convert Local Target to World Base
        const worldTargetBase = targetBody.getWorldPoint(chosenTargetLocal);
        const realDiff = worldTargetBase.clone().sub(pos);
        const dist = realDiff.length(); // Use distance to chosen target

        // 4. Intercept Prediction for that World Target
        const averageAttackSpeed = 12.0 * speed;
        let timeToIntercept = 0;
        if (averageAttackSpeed > 0) {
            timeToIntercept = dist / averageAttackSpeed;
            timeToIntercept = Math.min(timeToIntercept, 2.0) * 0.7;
        }

        // Predicted position of the stern point in world space
        const predictedWorldTarget = worldTargetBase.clone().add(playerVel.clone().mul(timeToIntercept));

        // 5. Blend between direct pursuit and intercept based on distance
        let predictionWeight = (dist - 8.0) / (40.0 - 8.0);
        predictionWeight = Math.max(0, Math.min(1, predictionWeight));

        const blendedTarget = planck.Vec2.combine(1 - predictionWeight, worldTargetBase, predictionWeight, predictedWorldTarget);
        const diff = blendedTarget.clone().sub(pos);

        // 6. State Machine Update
        // "isBehind" means we overshot our current target
        // Boat Forward is local -Y. 
        // We use the dot product of the normalized diff and our own forward to see if we are overshooting?
        // Actually, let's keep it simple: are we overshooting the boat?
        const boatForward = targetBody.getWorldVector(planck.Vec2(0, -1));
        const boatToAnimal = pos.clone().sub(targetPos);
        const isBehindBoat = planck.Vec2.dot(boatToAnimal, boatForward) < -Boat.STERN_Y * 2.0;

        switch (this.state) {
            case 'IDLE':
                this.updateIdle(dt, dist, startAttackDistance);
                break;
            case 'TURNING':
                this.updateTurning(dt, dist, diff, physicsBody, isBehindBoat, stopAttackDistance, speed);
                break;
            case 'ATTACKING':
                this.updateAttacking(dt, dist, diff, physicsBody, isBehindBoat, stopAttackDistance, speed);
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
