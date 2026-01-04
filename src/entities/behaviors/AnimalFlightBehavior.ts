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
    FINISHED
}

export class AnimalFlightBehavior implements EntityBehavior {
    private entity: AnimalFlight;
    private state: FlightState = FlightState.TOWARD_BOAT;

    private readonly MAX_HEIGHT = 15.0;
    private readonly BUZZ_HEIGHT = 2.5;
    private readonly HORIZ_SPEED: number = 30.0; // Units per second
    private readonly VERT_SPEED: number = 10.0;
    private readonly RIVER_MARGIN: number = 20.0;
    private readonly ROTATION_SPEED: number = Math.PI * 1.5; // Radians per second

    private flightTime: number = 0;
    private lastDirectionUpdateTime: number = -1; // Force immediate update
    private currentAngle: number = 0;
    private targetAngle: number = 0;

    constructor(entity: AnimalFlight) {
        this.entity = entity;

        const body = entity.getPhysicsBody();
        if (!body) return;

        // Disable collisions while in flight
        AnimalBehaviorUtils.setCollisionMask(body, 0);
        // Switch to kinematic for precise path control
        body.setType(planck.Body.KINEMATIC);
    }

    update(dt: number) {
        const body = this.entity.getPhysicsBody();
        const boatBody = Boat.getPlayerBody();
        if (!body || !boatBody) return;

        if (this.state === FlightState.TOWARD_BOAT) {
            this.updateTowardBoat(dt, body, boatBody);
        } else if (this.state === FlightState.AWAY_FROM_BOAT) {
            this.updateAwayFromBoat(dt, body, boatBody);
        } else if (this.state === FlightState.FINISHED) {

        }
    }

    private updateTowardBoat(dt: number, body: planck.Body, boatBody: planck.Body) {
        const currentPos = body.getPosition();
        const boatPos = boatBody.getPosition();
        const distToBoat = planck.Vec2.distance(currentPos, boatPos);

        // If we are very close to the boat
        if (distToBoat < 2.0) {
            this.state = FlightState.AWAY_FROM_BOAT;
            this.targetAngle = this.randomFlightAngle(boatBody);
            this.currentAngle = body.getAngle();
            this.flightTime = 0;
            this.lastDirectionUpdateTime = 0;
            return;
        }

        // Move toward boat
        const dir = boatPos.clone().sub(currentPos);
        dir.normalize();

        // Don't overshoot
        const distance = Math.min(distToBoat, this.HORIZ_SPEED * dt);
        const newPos = currentPos.clone().add(dir.mul(distance));
        body.setPosition(newPos);

        // Turn to face boat
        const angle = Math.atan2(dir.x, dir.y);
        body.setAngle(-angle + Math.PI);

        // Height calculation
        const currentHeight = this.entity.getHeight();
        if (distToBoat > 50.0) {
            // fly up
            if (currentHeight < this.MAX_HEIGHT) {
                const newHeight = currentHeight + this.VERT_SPEED * dt;
                this.entity.setExplictPosition(newHeight, new THREE.Vector3(0, 1, 0));
            }
        } else {
            // fly down
            if (currentHeight > this.BUZZ_HEIGHT) {
                const newHeight = currentHeight - this.VERT_SPEED * dt;
                this.entity.setExplictPosition(newHeight, new THREE.Vector3(0, 1, 0));
            }
        }
    }

    private updateAwayFromBoat(dt: number, body: planck.Body, boatBody: planck.Body) {
        this.flightTime += dt;

        // 1s direction update
        if (this.flightTime - this.lastDirectionUpdateTime > 1.0) {
            this.targetAngle = this.randomFlightAngle(boatBody);
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

        // Height increase
        const currentHeight = this.entity.getHeight();
        if (currentHeight < this.MAX_HEIGHT) {
            const newHeight = currentHeight + this.VERT_SPEED * dt;
            this.entity.setExplictPosition(newHeight, new THREE.Vector3(0, 1, 0));
        }

        // Over land check
        const banks = RiverSystem.getInstance().getBankPositions(currentPos.y);
        const nearRiver = banks.left - this.RIVER_MARGIN < currentPos.x && currentPos.x < banks.right + this.RIVER_MARGIN;

        if (!nearRiver) {
            this.state = FlightState.FINISHED;
            AnimalBehaviorUtils.setCollisionMask(body, 0xFFFF);
            body.setType(planck.Body.DYNAMIC);
            this.entity.flightDidComplete?.();
        }
    }

    private randomFlightAngle(boatBody: planck.Body): number {

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
