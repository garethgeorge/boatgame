import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../../world/RiverSystem';
import { AnimalFlight } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';

export class AnimalFlightBehavior implements EntityBehavior {
    private entity: AnimalFlight;
    private targetPosition: planck.Vec2;
    private flightDuration: number = 3.0; // Fixed duration for now
    private elapsedTime: number = 0;
    private flightHeight: number = 10.0;
    private initialHeight: number;
    private startPos: planck.Vec2;

    constructor(
        entity: AnimalFlight,
        initialHeight: number
    ) {
        this.entity = entity;
        this.initialHeight = initialHeight;

        const body = entity.getPhysicsBody();
        if (!body) {
            this.targetPosition = planck.Vec2(0, 0);
            this.startPos = planck.Vec2(0, 0);
            return;
        }

        this.startPos = body.getPosition().clone();

        // Find opposite bank
        const currentPos = this.startPos;
        const riverSystem = RiverSystem.getInstance();
        const center = riverSystem.getRiverCenter(currentPos.y);

        // Target is mirrored across the center
        const dx = currentPos.x - center;
        this.targetPosition = planck.Vec2(center - dx, currentPos.y - 50); // Move "forward" as well
    }

    update(dt: number) {
        this.elapsedTime += dt;
        const t = Math.min(this.elapsedTime / this.flightDuration, 1.0);

        const body = this.entity.getPhysicsBody();
        if (body) {
            // Interpolate position
            const newPos = planck.Vec2(
                this.startPos.x + (this.targetPosition.x - this.startPos.x) * t,
                this.startPos.y + (this.targetPosition.y - this.startPos.y) * t
            );
            body.setPosition(newPos);

            // Rotate to face direction
            const angle = Math.atan2(this.targetPosition.x - this.startPos.x, this.targetPosition.y - this.startPos.y);
            body.setAngle(-angle + Math.PI); // Adjust for model facing

            // Height adjustment - simple parabola
            const heightT = Math.sin(t * Math.PI);
            const currentHeight = this.initialHeight + heightT * this.flightHeight;
            this.entity.setLandPosition(currentHeight, new THREE.Vector3(0, 1, 0), 0);
        }

        if (t >= 1.0) {
            this.entity.flightDidComplete?.();
        }
    }
}
