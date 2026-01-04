import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../../world/RiverSystem';
import { AnimalFlight } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { Boat } from '../Boat';
import { AnimalBehaviorUtils } from './AnimalBehaviorUtils';

enum FlightState {
    TOWARD_BOAT,
    AWAY_FROM_BOAT,
    LANDING,
    FINISHED
}

export class AnimalFlightBehavior implements EntityBehavior {
    private entity: AnimalFlight;
    private state: FlightState = FlightState.TOWARD_BOAT;

    private readonly MAX_HEIGHT = 15.0;
    private readonly BUZZ_HEIGHT = 2.5;
    private readonly HORIZ_SPEED: number = 30.0; // Meters per second
    private readonly VERT_SPEED: number = 10.0;
    private readonly RIVER_MARGIN: number = 20.0;
    private readonly ROTATION_SPEED: number = Math.PI * 1.0; // Radians per second
    private readonly LOCK_ON_DISTANCE: number = 75.0;

    private flightTime: number = 0;
    private lastDirectionUpdateTime: number = -1; // Force immediate update
    private currentAngle: number = 0;
    private targetAngle: number = 0;
    private landingStartAltitude: number = 0;

    constructor(entity: AnimalFlight) {
        this.entity = entity;

        const body = entity.getPhysicsBody();
        if (!body) return;

        // Disable collisions while in flight
        AnimalBehaviorUtils.setCollisionMask(body, 0);
        // Switch to kinematic for precise path control
        body.setType(planck.Body.KINEMATIC);

        this.currentAngle = body.getAngle();
        this.targetAngle = this.currentAngle;
    }

    update(dt: number) {
        const body = this.entity.getPhysicsBody();
        const boatBody = Boat.getPlayerBody();
        if (!body || !boatBody) return;

        if (this.state === FlightState.TOWARD_BOAT) {
            this.updateTowardBoat(dt, body, boatBody);
        } else if (this.state === FlightState.AWAY_FROM_BOAT) {
            this.updateAwayFromBoat(dt, body, boatBody);
        } else if (this.state === FlightState.LANDING) {
            this.updateLanding(dt, body, boatBody);
        }
    }

    private updateTowardBoat(dt: number, body: planck.Body, boatBody: planck.Body) {
        this.flightTime += dt;
        const currentPos = body.getPosition();
        const boatPos = boatBody.getPosition();
        const distToBoat = planck.Vec2.distance(currentPos, boatPos);

        // If we are very close to the boat
        if (distToBoat < 2.0) {
            this.state = FlightState.AWAY_FROM_BOAT;
            this.targetAngle = this.randomAngleAway(boatBody);
            this.currentAngle = body.getAngle();
            this.lastDirectionUpdateTime = this.flightTime;
            return;
        }

        // Periodic direction update toward boat
        if (this.flightTime - this.lastDirectionUpdateTime > 1.0) {
            const dirToBoat = boatPos.clone().sub(currentPos);
            let angleToBoat = Math.atan2(dirToBoat.x, -dirToBoat.y);

            if (distToBoat > this.LOCK_ON_DISTANCE) {
                // Random offset +/- 45 degrees
                const offsetRad = (Math.random() - 0.5) * Math.PI * 0.5;
                this.targetAngle = angleToBoat + offsetRad;
            } else {
                // Lock on
                this.targetAngle = angleToBoat;
            }
            this.lastDirectionUpdateTime = this.flightTime;
        }

        // Turn to desired direction
        this.currentAngle = this.rotateToward(this.currentAngle, this.targetAngle, this.ROTATION_SPEED * dt);

        // Move
        const flightDir = planck.Vec2(Math.sin(this.currentAngle), -Math.cos(this.currentAngle));
        const distance = Math.min(distToBoat, this.HORIZ_SPEED * dt);
        const newPos = currentPos.clone().add(flightDir.mul(distance));
        body.setPosition(newPos);

        // Turn to face direction
        body.setAngle(this.currentAngle);

        // Height calculation
        const targetHeight = distToBoat > 50.0 ? this.MAX_HEIGHT : this.BUZZ_HEIGHT;
        const currentHeight = this.entity.getHeight();
        const newHeight = this.calculateHeight(currentPos, currentHeight, targetHeight, dt);
        this.entity.setExplictPosition?.(newHeight, new THREE.Vector3(0, 1, 0));
    }

    private updateAwayFromBoat(dt: number, body: planck.Body, boatBody: planck.Body) {
        this.flightTime += dt;

        // 1s direction update
        if (this.flightTime - this.lastDirectionUpdateTime > 1.0) {
            this.targetAngle = this.randomAngleAway(boatBody);
            this.lastDirectionUpdateTime = this.flightTime;
        }

        // turn to desired direction
        this.currentAngle = this.rotateToward(this.currentAngle, this.targetAngle, this.ROTATION_SPEED * dt);

        // Move
        const flightDir = planck.Vec2(Math.sin(this.currentAngle), -Math.cos(this.currentAngle));
        const currentPos = body.getPosition();
        const newPos = currentPos.clone().add(flightDir.mul(this.HORIZ_SPEED * dt));
        body.setPosition(newPos);

        // Turn to face direction
        body.setAngle(this.currentAngle);

        // Update height
        const currentHeight = this.entity.getHeight();
        const newHeight = this.calculateHeight(currentPos, currentHeight, this.MAX_HEIGHT, dt);
        this.entity.setExplictPosition?.(newHeight, new THREE.Vector3(0, 1, 0));

        // Over land check
        const banks = RiverSystem.getInstance().getBankPositions(currentPos.y);
        const nearRiver = banks.left - this.RIVER_MARGIN < currentPos.x && currentPos.x < banks.right + this.RIVER_MARGIN;

        if (!nearRiver) {
            this.state = FlightState.LANDING;

            // Pick landing orientation facing toward the river based on slope
            const derivative = RiverSystem.getInstance().getRiverDerivative(currentPos.y);
            if (currentPos.x < banks.left) {
                // Left side: Normal toward river is (1, -derivative)
                this.targetAngle = Math.atan2(1, derivative); // Math.atan2(nx, -nz) = Math.atan2(1, -(-derivative))
            } else {
                // Right side: Normal toward river is (-1, derivative)
                this.targetAngle = Math.atan2(-1, -derivative); // Math.atan2(nx, -nz) = Math.atan2(-1, -(derivative))
            }

            const groundHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(currentPos.x, currentPos.y);
            this.landingStartAltitude = Math.max(0.1, currentHeight - groundHeight);
        }
    }

    private updateLanding(dt: number, body: planck.Body, boatBody: planck.Body) {
        const currentPos = body.getPosition();
        const currentHeight = this.entity.getHeight();
        const groundHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(currentPos.x, currentPos.y);
        const currentAltitude = Math.max(0, currentHeight - groundHeight);

        // Turn to landing direction
        this.currentAngle = this.rotateToward(this.currentAngle, this.targetAngle, this.ROTATION_SPEED * dt);

        // Horizontal movement - speed interpolates to 0 as we land
        const speedFactor = Math.max(0, Math.min(1, currentAltitude / this.landingStartAltitude));
        const currentSpeed = this.HORIZ_SPEED * speedFactor;

        const flightDir = planck.Vec2(Math.sin(this.currentAngle), -Math.cos(this.currentAngle));
        const newPos = currentPos.clone().add(flightDir.mul(currentSpeed * dt));
        body.setPosition(newPos);
        body.setAngle(this.currentAngle);

        // Descend to ground
        const newHeight = this.calculateHeight(currentPos, currentHeight, 0, dt);
        this.entity.setExplictPosition?.(newHeight, new THREE.Vector3(0, 1, 0));

        // Finish flight if on ground and stopped
        if (currentAltitude < 0.1 && currentSpeed < 1.0) {
            this.state = FlightState.FINISHED;
            AnimalBehaviorUtils.setCollisionMask(body, 0xFFFF);
            body.setType(planck.Body.DYNAMIC);
            this.entity.flightDidComplete?.();
        }
    }

    private calculateHeight(currentPos: planck.Vec2, currentHeight: number,
        heightOffset: number, dt: number): number {
        // Height increase
        const groundHeightAtPos = RiverSystem.getInstance().terrainGeometry.calculateHeight(currentPos.x, currentPos.y);
        const baseHeight = Math.max(0, groundHeightAtPos);
        const targetHeight = baseHeight + heightOffset;

        if (currentHeight < targetHeight) {
            return Math.min(targetHeight, currentHeight + this.VERT_SPEED * dt);
        } else if (currentHeight > targetHeight) {
            return Math.max(targetHeight, currentHeight - this.VERT_SPEED * dt);
        } else {
            return currentHeight;
        }
    }

    private randomAngleAway(boatBody: planck.Body): number {

        let boatAngle = boatBody.getAngle();

        // Offset between 30 and 50 degrees
        const offsetDeg = 30 + Math.random() * 20;
        const offsetRad = (offsetDeg * Math.PI) / 180.0;

        // Random side
        const side = Math.random() < 0.5 ? -1 : 1;

        return boatAngle + side * offsetRad;
    }

    private rotateToward(startAngle: number, endAngle: number, maxRotation: number): number {
        // Constant rate rotation (shortest arc)
        let diff = endAngle - startAngle;
        if (diff === 0.0) return startAngle;

        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        let newAngle = startAngle;
        if (Math.abs(diff) < maxRotation) {
            newAngle = endAngle;
        } else {
            newAngle += Math.sign(diff) * maxRotation;
        }

        // Normalize
        while (newAngle > Math.PI) newAngle -= Math.PI * 2;
        while (newAngle < -Math.PI) newAngle += Math.PI * 2;

        return newAngle;
    }
}
