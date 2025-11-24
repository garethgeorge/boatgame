import * as THREE from 'three';

export class BoatPhysics {
    constructor() {
        // Core state
        this.velocity = new THREE.Vector3();
        this.angularVelocity = 0;

        // Configuration tuned for a "speed boat" feel
        this.turnSpeed = 0.4; // Allows a reasonable turning circle
        this.forwardDragCoeff = 15.0; // High drag for quick deceleration
        this.sidewaysDragCoeff = 35.0; // Very high sideways drag to prevent sliding
        this.rudderOffset = -1.5; // Reduced to soften turn initiation
        this.mass = 200; // Heavier boat
        this.momentOfInertia = 200; // Lowered to make turning more nimble
        this.angularDrag = 8.0; // Strong rotational damping for stability
        this.riverFlowSpeed = 0.0; // No river current
        this.rudderEffectiveness = 10.0; // Subtle rudder effect when coasting

        // Game-specific parameters
        this.boostAcceleration = 5000.0; // High thrust for quick acceleration
        this.throttleStep = 1.0; // Faster throttle response
        
        // State
        this.currentSteeringAngle = 0;
        this.throttle = 0.0;
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

    update(dt, input, rotationY, riverTangent) {
        // --- 1. Gather and process input ---
        // Steering: A=Left, D=Right
        const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        
        // Adjust throttle
        if (input.forward) {
            this.throttle += this.throttleStep * dt;
        }
        if (input.backward) {
            this.throttle -= this.throttleStep * dt;
        }
        // Clamp throttle between 0% and 100%
        this.throttle = Math.max(0.0, Math.min(1.0, this.throttle));

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
        const thrustMagnitude = this.throttle * this.boostAcceleration;
        
        // The thrust vector rotates with the rudder/engine
        const thrustLocalDir = new THREE.Vector3(
            -Math.sin(this.currentSteeringAngle), // Inverted for correct turning
            0,
            Math.cos(this.currentSteeringAngle)
        );
        const thrustForceLocal = thrustLocalDir.multiplyScalar(thrustMagnitude);
        const thrustForceWorld = this.transformDirection(thrustForceLocal, rotationY);

        // Apply force for linear motion
        totalForce.add(thrustForceWorld);
        
        // Apply torque for rotation from thrust
        const torqueFromThrust = this.rudderOffset * thrustForceLocal.x;
        totalTorque += torqueFromThrust;

        // b) Hydrodynamics (Drag & Rudder)
        const riverVelocity = riverTangent ? riverTangent.clone().multiplyScalar(this.riverFlowSpeed) : new THREE.Vector3();
        const relativeVelocity = this.velocity.clone().sub(riverVelocity);
        const localRelativeVelocity = this.inverseTransformDirection(relativeVelocity, rotationY);
        
        const forwardSpeed = localRelativeVelocity.z;
        const sideSpeed = localRelativeVelocity.x;

        // Rudder force (based on water flow over the rudder)
        const rudderSideForce = -this.rudderEffectiveness * forwardSpeed * Math.abs(forwardSpeed) * Math.sin(this.currentSteeringAngle); // Inverted for correct turning
        const torqueFromRudder = this.rudderOffset * rudderSideForce;
        totalTorque += torqueFromRudder;

        // Quadratic drag formula: F = -C * v * |v|
        const forwardDragForce = -this.forwardDragCoeff * forwardSpeed * Math.abs(forwardSpeed);
        const sideDragForce = -this.sidewaysDragCoeff * sideSpeed * Math.abs(sideSpeed);
        
        const resistanceLocal = new THREE.Vector3(sideDragForce, 0, forwardDragForce);
        const resistanceWorld = this.transformDirection(resistanceLocal, rotationY);
        totalForce.add(resistanceWorld);

        // c) River boundary constraint
        if (riverTangent) {
            const boatForward = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
            const angle = boatForward.angleTo(riverTangent);
            if (angle > Math.PI / 2) {
                const cross = new THREE.Vector3().crossVectors(boatForward, riverTangent);
                const correctionStrength = 5.0;
                if (cross.y > 0) {
                    this.angularVelocity += correctionStrength * dt;
                } else {
                    this.angularVelocity -= correctionStrength * dt;
                }
                this.velocity.multiplyScalar(0.95);
            }
        }

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

    checkEdgeCollisions(position, segments, radius) {
        let collisionDetected = false;

        for (const segment of segments) {
            // Segment vector
            const segVec = new THREE.Vector3().subVectors(segment.end, segment.start);
            const segLen = segVec.length();
            const segDir = segVec.clone().divideScalar(segLen);

            // Vector from start to boat
            const toBoat = new THREE.Vector3().subVectors(position, segment.start);
            
            // Project boat onto segment line (t is distance along segment)
            const t = toBoat.dot(segDir);
            
            // Closest point on segment
            let closestPoint;
            if (t < 0) {
                closestPoint = segment.start;
            } else if (t > segLen) {
                closestPoint = segment.end;
            } else {
                closestPoint = segment.start.clone().add(segDir.multiplyScalar(t));
            }

            // Distance to closest point
            const distVec = new THREE.Vector3().subVectors(position, closestPoint);
            const dist = distVec.length();

            // Check collision
            if (dist < radius) {
                // Determine if we are on the "wrong" side.
                // The normal points towards the river center (valid area).
                // So if distVec dot normal < 0, we are behind the wall?
                // Or if we are just overlapping the wall line.
                
                // Let's assume the wall is a hard boundary.
                // We want to push the boat along the normal direction until dist >= radius.
                
                // Calculate penetration depth
                const penetration = radius - dist;
                
                // Push direction: usually the normal of the wall.
                // However, if we hit the endpoint, we might want to push away from the point.
                // Let's use the segment normal for consistent sliding along the wall.
                const pushDir = segment.normal.clone();
                
                // Check if we are actually "behind" the wall.
                // Vector from wall to boat dot Normal.
                const side = distVec.dot(segment.normal);
                
                // If side is negative, we are deep inside the wall/bank.
                // If side is positive but < radius, we are just touching.
                
                // Correction
                // If we are behind, we need to push out fully + radius.
                // If we are in front, we push out by penetration.
                
                let correction;
                if (side < 0) {
                    // Behind wall
                    // Push to the line, then add radius
                    // Projected distance to line is 'side' (negative)
                    correction = -side + radius;
                } else {
                    // In front but touching
                    correction = radius - dist; // Approximate, assuming distVec aligns with normal
                    // Better: correction = radius - side? 
                    // If we use 'dist', we push away from the closest point (good for corners).
                    // If we use 'side', we push away from the line (good for straight walls).
                    
                    // Let's use the wall normal for the push direction to ensure sliding.
                    correction = radius - side;
                }
                
                // Apply position correction
                position.add(pushDir.multiplyScalar(correction * 0.2)); // Soft correction
                
                // Velocity damping
                const vDotN = this.velocity.dot(pushDir);
                if (vDotN < 0) {
                    // Cancel velocity into the wall
                    const vNormal = pushDir.clone().multiplyScalar(vDotN);
                    this.velocity.sub(vNormal.multiplyScalar(1.5)); // Bounce/Slide
                }
                
                collisionDetected = true;
            }
        }
        return collisionDetected;
    }
}