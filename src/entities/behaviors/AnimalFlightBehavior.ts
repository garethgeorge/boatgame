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

    private flightTime: number = 0;
    private lastDirectionUpdateTime: number = -1; // Force immediate update
    private currentFlightDir: planck.Vec2 = planck.Vec2(0, 1);

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
            this.currentFlightDir = this.randomFlightDirection(boatBody);
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
            this.currentFlightDir = this.randomFlightDirection(boatBody);
            this.lastDirectionUpdateTime = this.flightTime;
        }

        // Move
        const currentPos = body.getPosition();
        const newPos = currentPos.clone().add(this.currentFlightDir.clone().mul(this.HORIZ_SPEED * dt));
        body.setPosition(newPos);

        // Turn to face direction
        const angle = Math.atan2(this.currentFlightDir.x, this.currentFlightDir.y);
        body.setAngle(-angle + Math.PI);

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

    private randomFlightDirection(boatBody: planck.Body): planck.Vec2 {

        // "direction the boat is moving"
        const vel = boatBody.getLinearVelocity();
        let boatAngle = boatBody.getAngle();

        if (vel.length() > 0.5) {
            boatAngle = Math.atan2(vel.y, vel.x) + Math.PI / 2;
        }

        // Offset between 30 and 50 degrees
        const offsetDeg = 30 + Math.random() * 20;
        const offsetRad = (offsetDeg * Math.PI) / 180.0;

        // Random side
        const side = Math.random() < 0.5 ? -1 : 1;

        const targetAngle = boatAngle + side * offsetRad;
        return planck.Vec2(Math.sin(targetAngle), -Math.cos(targetAngle));
    }
}
