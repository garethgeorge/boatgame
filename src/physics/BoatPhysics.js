import * as THREE from 'three';

export class BoatPhysics {
    constructor() {
        this.velocity = new THREE.Vector3();
        this.angularVelocity = 0;
        this.acceleration = 15.0;
        this.turnSpeed = 2.0;
        this.drag = 2.0;
        this.angularDrag = 3.0;
        this.maxSpeed = 20.0;
    }

    update(dt, input, rotationY) {
        // Forward vector based on current rotation
        const forward = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
        
        // Apply thrust
        if (input.forward) {
            this.velocity.add(forward.clone().multiplyScalar(this.acceleration * dt));
        }
        if (input.backward) {
            this.velocity.sub(forward.clone().multiplyScalar(this.acceleration * 0.5 * dt));
        }

        // Apply turning torque
        if (input.left) {
            this.angularVelocity += this.turnSpeed * dt;
        }
        if (input.right) {
            this.angularVelocity -= this.turnSpeed * dt;
        }

        // Apply drag
        this.velocity.multiplyScalar(1.0 - Math.min(this.drag * dt, 1.0));
        this.angularVelocity *= (1.0 - Math.min(this.angularDrag * dt, 1.0));

        // Clamp speed
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.setLength(this.maxSpeed);
        }

        return {
            velocity: this.velocity,
            angularVelocity: this.angularVelocity
        };
    }
}
