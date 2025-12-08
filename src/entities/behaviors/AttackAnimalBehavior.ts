import * as planck from 'planck';
import * as THREE from 'three';
import { CollisionCategories } from '../../core/PhysicsEngine';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';
import { AttackAnimal } from './AttackAnimal';

export class AttackAnimalBehavior {
    private entity: AttackAnimal;
    private state: 'IDLE' | 'TURNING' | 'ATTACKING' | 'ONSHORE' | 'ENTERING_WATER' = 'IDLE';
    private targetWaterHeight: number;

    // speed factor for entering water/attacking
    private speed: number;
    // distance to boat to start entering water
    private enterWaterDistance: number;
    // distance to boat to start attacking
    private startAttackDistance: number;
    // distance to boat to break off attacking
    private stopAttackDistance: number;

    constructor(entity: AttackAnimal, startOnShore: boolean = false, targetWaterHeight: number = -1.0) {
        this.entity = entity;
        this.targetWaterHeight = targetWaterHeight;

        const aggressiveness = Math.random();
        this.speed = 1 + 3 * aggressiveness;
        this.enterWaterDistance = 100 + 100 * aggressiveness;
        this.startAttackDistance = 30 + 60 * aggressiveness;
        this.stopAttackDistance = this.startAttackDistance + 20;

        if (startOnShore) {
            this.state = 'ONSHORE';
        }
    }

    update() {
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
            case 'ONSHORE':
                this.updateOnShore(dist, physicsBody);
                break;
            case 'ENTERING_WATER':
                this.updateEnteringWater(pos, physicsBody);
                break;
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

    private updateOnShore(dist: number, physicsBody: planck.Body) {
        // Activate when boat is within 100 units
        if (dist < this.enterWaterDistance) {
            this.state = 'ENTERING_WATER';
            this.entity.didStartEnteringWater?.();

            // Ignore terrain collision
            this.setCollisionMask(physicsBody, 0xFFFF ^ CollisionCategories.TERRAIN);
        }
    }

    private updateEnteringWater(pos: planck.Vec2, physicsBody: planck.Body) {
        // Move forward in current facing direction
        const speed = 8.0 * this.speed; // Walking speed
        const angle = physicsBody.getAngle() - Math.PI / 2;
        physicsBody.applyForceToCenter(planck.Vec2(Math.cos(angle), Math.sin(angle)).mul(speed * physicsBody.getMass()));

        // Check if fully over water
        const banks = RiverSystem.getInstance().getBankPositions(pos.y);
        const margin = 2.0;

        // Calculate distance into water (positive means inside water area)
        const distFromLeft = pos.x - banks.left;
        const distFromRight = banks.right - pos.x;
        const distIntoWater = Math.min(distFromLeft, distFromRight);

        // Target (water) values
        const targetHeight = this.targetWaterHeight;
        const targetNormal = new THREE.Vector3(0, 1, 0);

        const epsilon = 0.1;

        if (distIntoWater < epsilon) {
            // Still on land
            const height = RiverSystem.getInstance().terrainGeometry.calculateHeight(pos.x, pos.y);
            const normal = RiverSystem.getInstance().terrainGeometry.calculateNormal(pos.x, pos.y);
            this.entity.setLandPosition(height, normal);
        } else if (distIntoWater < 0) {
            // Close to water edge don't update height/normal because it's not stable 
        } else if (distIntoWater < margin) {
            // Transition zone - interpolate
            const t = distIntoWater / margin;

            // Interpolate height
            const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(pos.x, pos.y);
            const height = THREE.MathUtils.lerp(terrainHeight, targetHeight, t);

            // Interpolate normal
            const terrainNormal = RiverSystem.getInstance().terrainGeometry.calculateNormal(pos.x, pos.y);
            const normal = terrainNormal.clone().lerp(targetNormal, t).normalize();

            this.entity.setLandPosition(height, normal);
        } else {
            // Fully in water
            this.state = 'IDLE';
            this.entity.setWaterPosition(targetHeight);

            // Restore collision with terrain
            this.setCollisionMask(physicsBody, 0xFFFF);
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

    private setCollisionMask(body: planck.Body, maskBits: number) {
        for (let b = body.getFixtureList(); b; b = b.getNext()) {
            b.setFilterData({
                categoryBits: b.getFilterCategoryBits(),
                maskBits: maskBits,
                groupIndex: b.getFilterGroupIndex()
            });
        }
    }
}
