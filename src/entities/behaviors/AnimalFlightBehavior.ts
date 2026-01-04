import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../../world/RiverSystem';
import { AnimalFlight } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { Boat } from '../Boat';
import { AnimalBehaviorUtils } from './AnimalBehaviorUtils';

enum FlightState {
    TOWARD_BOAT,
    AWAY_FROM_BOAT
}

export class AnimalFlightBehavior implements EntityBehavior {
    private entity: AnimalFlight;
    private state: FlightState = FlightState.TOWARD_BOAT;

    private startPos: planck.Vec2;
    private initialHeight: number;

    private buzzHeight: number = 2.0;
    private finalHeight: number = 10.0;
    private speed: number = 45.0; // Units per second
    private targetZOffset = -100.0;

    private targetPos: planck.Vec2;
    private targetDistance: number;

    constructor(
        entity: AnimalFlight,
        initialHeight: number
    ) {
        this.entity = entity;
        this.initialHeight = initialHeight;

        const body = entity.getPhysicsBody();
        const boatBody = Boat.getPlayerBody();

        if (!body || !boatBody) {
            this.startPos = planck.Vec2(0, 0);
            return;
        }

        // Disable collisions while in flight
        AnimalBehaviorUtils.setCollisionMask(body, 0);

        this.startPos = body.getPosition().clone();
    }

    update(dt: number) {
        const body = this.entity.getPhysicsBody();
        const boatBody = Boat.getPlayerBody();
        if (!body || !boatBody) return;

        const currentPos = body.getPosition();
        const boatPos = boatBody.getPosition();

        if (this.state === FlightState.TOWARD_BOAT) {
            this.updateTowardBoat(dt, body, currentPos, boatPos);
        } else {
            this.updateAwayFromBoat(dt, body, currentPos, boatPos);
        }
    }

    private updateTowardBoat(dt: number, body: planck.Body, currentPos: planck.Vec2, boatPos: planck.Vec2) {
        const distToBoat = planck.Vec2.distance(currentPos, boatPos);

        // If we are very close to the boat orHave passed it (dot product with original direction might be better but distance is simple)
        // Let's use distance threshold
        if (distToBoat < 2.0) {
            this.state = FlightState.AWAY_FROM_BOAT;

            // Choose target landing site
            const dstz = currentPos.y + this.targetZOffset;
            const riverSystem = RiverSystem.getInstance();
            const { left: srcleft, right: srcright } = riverSystem.getBankPositions(this.startPos.y);
            const { left: dstleft, right: dstright } = riverSystem.getBankPositions(dstz);
            if (this.startPos.x < srcleft) {
                const dx = srcleft - this.startPos.x;
                this.targetPos = new planck.Vec2(dstright + dx, dstz);
            } else {
                const dx = this.startPos.x - srcright;
                this.targetPos = new planck.Vec2(dstleft - dx, dstz);
            }
            this.targetDistance = planck.Vec2.distance(currentPos, this.targetPos);
            return;
        }

        // Move toward boat
        const dir = boatPos.clone().sub(currentPos);
        dir.normalize();

        const newPos = currentPos.clone().add(dir.mul(this.speed * dt));
        body.setPosition(newPos);

        // Face boat
        const angle = Math.atan2(dir.x, dir.y);
        body.setAngle(-angle + Math.PI);

        // Height calculation based on progress from startPos to boatPos
        const totalDistToBoat = planck.Vec2.distance(this.startPos, boatPos);
        const distFromStart = planck.Vec2.distance(this.startPos, currentPos);
        // Progress 0 to 1
        const progress = Math.min(distFromStart / totalDistToBoat, 1.0);

        // Use a smooth curve for height (e.g. cosine or quadratic)
        // Parabola: y = a(x-h)^2 + k where h=1, k=buzzHeight, a=(initialHeight-buzzHeight)
        // Wait, simpler: h(p) = initialHeight + (buzzHeight - initialHeight) * sin(p * PI/2)
        // That only goes one way. We want to descend from initial to buzz.
        const heightT = Math.sin(progress * Math.PI * 0.5); // 0 to 1
        const currentHeight = this.initialHeight + (this.buzzHeight - this.initialHeight) * heightT;

        this.entity.setLandPosition(currentHeight, new THREE.Vector3(0, 1, 0), 0);
    }

    private updateAwayFromBoat(dt: number, body: planck.Body, currentPos: planck.Vec2, boatPos: planck.Vec2) {
        const distToTarget = planck.Vec2.distance(currentPos, this.targetPos);

        if (distToTarget < 2.0) {
            AnimalBehaviorUtils.setCollisionMask(body, 0xFFFF);
            this.entity.flightDidComplete?.();
            return;
        }

        const dir = this.targetPos.clone().sub(currentPos);
        dir.normalize();

        const newPos = currentPos.clone().add(dir.mul(this.speed * dt));
        body.setPosition(newPos);

        const angle = Math.atan2(dir.x, dir.y);
        body.setAngle(-angle + Math.PI);

        // Height calculation based on progress from where we started "AWAY" to target
        const progress = 1.0 - Math.min(distToTarget / this.targetDistance, 1.0);

        // Ascend from buzzHeight to finalHeight
        const heightT = Math.sin(progress * Math.PI * 0.5); // 0 to 1
        const currentHeight = this.buzzHeight + (this.finalHeight - this.buzzHeight) * heightT;

        this.entity.setLandPosition(currentHeight, new THREE.Vector3(0, 1, 0), 0);
    }
}
