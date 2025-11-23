import * as THREE from 'three';

export class BoatPhysics {
    constructor() {
        this.velocity = new THREE.Vector3();
        this.angularVelocity = 0;
        this.acceleration = 16.0; // Boost acceleration
        this.autoAcceleration = 32.0; // Constant forward push (Base speed ~16)
        this.turnSpeed = 2.0;
        this.drag = 2.0;
        this.angularDrag = 3.0;
        this.maxSpeed = 25.0; // Cap at ~25
    }

    update(dt, input, rotationY) {
        // Forward vector based on current rotation
        const forward = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
        
        // Always apply auto-forward thrust
        this.velocity.add(forward.clone().multiplyScalar(this.autoAcceleration * dt));

        // Apply boost thrust
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

    constrainToRiver(currentRotation, riverTangent) {
        // Calculate angle between boat forward and river tangent
        const boatForward = new THREE.Vector3(Math.sin(currentRotation), 0, Math.cos(currentRotation));
        const angle = boatForward.angleTo(riverTangent);
        
        // If angle is too large (> 90 degrees), apply a correcting torque
        if (angle > Math.PI / 2) {
            // Determine which way to turn to align with river
            const cross = new THREE.Vector3().crossVectors(boatForward, riverTangent);
            const correctionStrength = 5.0;
            
            if (cross.y > 0) {
                this.angularVelocity += correctionStrength * 0.016; // Assuming ~60fps dt
            } else {
                this.angularVelocity -= correctionStrength * 0.016;
            }
            
            // Dampen velocity if trying to go backwards
            this.velocity.multiplyScalar(0.95);
        }
    }

    checkWallCollisions(position, riverCenter, riverWidth) {
        // Calculate distance from river center
        const dist = position.distanceTo(riverCenter);
        const safeRadius = (riverWidth / 2) - 2; // Buffer for boat size
        
        if (dist > safeRadius) {
            // Hit the wall
            // Push back towards center
            const toCenter = new THREE.Vector3().subVectors(riverCenter, position).normalize();
            
            // Soft push instead of hard clamp
            const penetration = dist - safeRadius;
            position.add(toCenter.multiplyScalar(penetration * 0.1)); // 10% correction per frame
            
            // Dampen velocity perpendicular to wall
            const vDotN = this.velocity.dot(toCenter);
            if (vDotN < 0) { // Moving away from center (towards wall)
                // Remove component of velocity towards wall
                const vNormal = toCenter.clone().multiplyScalar(vDotN);
                this.velocity.sub(vNormal);
                
                // No bounce, just slide
            }
        }
    }
}
