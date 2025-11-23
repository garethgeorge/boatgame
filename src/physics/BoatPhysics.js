import * as THREE from 'three';

export class BoatPhysics {
    constructor() {
        // Core state
        this.velocity = new THREE.Vector3();
        this.angularVelocity = 0;

        // Configuration tuned for more responsive control
        this.turnSpeed = 0.7; // Max rudder angle in radians (~40 degrees)
        this.forwardDragCoeff = 3.0; // Increased forward drag to limit top speed
        this.sidewaysDragCoeff = 25.0; // Increased for stronger 'bite'
        this.rudderOffset = -2.5; // Increased for more steering authority
        this.mass = 200; // Heavier boat
        this.momentOfInertia = 300; // Lowered to make rotation more responsive
        this.angularDrag = 8.0; // Strong rotational damping

        // Game-specific parameters
        this.autoAcceleration = 0.0; // Eliminated constant forward push
        this.boostAcceleration = 1000.0; // Increased for more power
        this.reverseAcceleration = -800.0;
        
        // State for steering
        this.currentSteeringAngle = 0;
    }

    lerp(start, end, t) {
        return start + (end - start) * t;
    }
    
    transformDirection(vec, rotationY) {
        return vec.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    }
    
    inverseTransformDirection(vec, rotationY) {
        return vec.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotationY);
    }

    update(dt, input, rotationY) {
        // --- 1. Gather Input ---
        // Invert steerInput
        const steerInput = -((input.left ? 1 : 0) - (input.right ? 1 : 0));
        let throttleInput = 0;
        if (input.forward) throttleInput = 1.0;
        if (input.backward) throttleInput = -0.5;

        // --- 2. Calculate Steering ---
        // Smooth the steering input
        const targetAngle = steerInput * this.turnSpeed;
        this.currentSteeringAngle = this.lerp(
            this.currentSteeringAngle,
            targetAngle,
            dt * 3.0 // Smoothing factor
        );

        // --- 3. Calculate Forces & Torques ---
        const totalForce = new THREE.Vector3();
        let totalTorque = 0;

        // a) Thrust
        const thrustMagnitude = this.autoAcceleration + (throttleInput * (throttleInput > 0 ? this.boostAcceleration : this.reverseAcceleration));
        
        // The thrust vector rotates with the rudder/engine
        const thrustLocalDir = new THREE.Vector3(
            Math.sin(this.currentSteeringAngle),
            0,
            Math.cos(this.currentSteeringAngle)
        );
        const thrustForceLocal = thrustLocalDir.multiplyScalar(thrustMagnitude);
        const thrustForceWorld = this.transformDirection(thrustForceLocal, rotationY);

        // Apply force for linear motion
        totalForce.add(thrustForceWorld);
        
        // Apply torque for rotation (T = r x F)
        // r is the lever arm from CoM to propeller. F is the thrust force.
        // Simplified: Torque around Y is rudderOffset * local_force_X
        const torqueFromThrust = this.rudderOffset * thrustForceLocal.x;
        totalTorque += torqueFromThrust;

        // b) Hydrodynamics (Drag)
        const localVel = this.inverseTransformDirection(this.velocity, rotationY);
        const forwardSpeed = localVel.z;
        const sideSpeed = localVel.x;

        // Quadratic drag formula: F = -C * v * |v|
        const forwardDragForce = -this.forwardDragCoeff * forwardSpeed * Math.abs(forwardSpeed);
        const sideDragForce = -this.sidewaysDragCoeff * sideSpeed * Math.abs(sideSpeed);
        
        const resistanceLocal = new THREE.Vector3(sideDragForce, 0, forwardDragForce);
        const resistanceWorld = this.transformDirection(resistanceLocal, rotationY);
        totalForce.add(resistanceWorld);

        // --- 4. Update Physics State (Integrate) ---
        // Linear
        const linear_acceleration = totalForce.divideScalar(this.mass);
        this.velocity.add(linear_acceleration.multiplyScalar(dt));

        // Angular
        const angular_acceleration = totalTorque / this.momentOfInertia;
        this.angularVelocity += angular_acceleration * dt;

        // c) Apply direct rotational damping (very important for stability)
        this.angularVelocity *= (1.0 - Math.min(this.angularDrag * dt, 1.0));

        // --- Return state for Boat.js ---
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
            const correctionStrength = 5.0; // This is a "magic" force, not physically based
            
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
                this.velocity.sub(vNormal.multiplyScalar(1.2)); // Bounce slightly
            }
        }
    }
}