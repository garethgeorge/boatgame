import * as THREE from 'three';

export interface PhysicsState {
    velocity: THREE.Vector3;
    angularVelocity: number;
}

export interface CollisionResult {
    collided: boolean;
    normal?: THREE.Vector3;
    penetration?: number;
}

export interface InputState {
    left: boolean;
    right: boolean;
    forward: boolean;
    backward: boolean;
}

export class BoatPhysics {
    velocity: THREE.Vector3;
    angularVelocity: number;
    turnSpeed: number;
    forwardDragCoeff: number;
    sidewaysDragCoeff: number;
    rudderOffset: number;
    mass: number;
    momentOfInertia: number;
    angularDrag: number;
    riverFlowSpeed: number;
    rudderEffectiveness: number;
    boostAcceleration: number;
    throttleStep: number;
    currentSteeringAngle: number;
    throttle: number;

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

    lerp(start: number, end: number, t: number): number {
        return start + (end - start) * t;
    }

    transformDirection(vec: THREE.Vector3, rotationY: number): THREE.Vector3 {
        return vec.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    }

    inverseTransformDirection(vec: THREE.Vector3, rotationY: number): THREE.Vector3 {
        return vec.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotationY);
    }

    update(dt: number, input: InputState, rotationY: number, riverTangent: THREE.Vector3 | null): PhysicsState {
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

    checkEdgeCollisions(position: THREE.Vector3, segments: any[], radius: number): boolean {
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
    checkRectangularCollision(boatPos: THREE.Vector3, boatRadius: number, rectPos: THREE.Vector3, rectSize: THREE.Vector3, rectRotation: number): CollisionResult {
        // Transform boat position into rectangle's local space
        const localPos = boatPos.clone().sub(rectPos);
        localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rectRotation);

        // Rectangle half-extents
        const halfWidth = rectSize.x / 2;
        const halfDepth = rectSize.z / 2;

        // Find closest point on rectangle to circle center
        const closestX = Math.max(-halfWidth, Math.min(halfWidth, localPos.x));
        const closestZ = Math.max(-halfDepth, Math.min(halfDepth, localPos.z));

        // Distance from closest point to circle center
        const distanceX = localPos.x - closestX;
        const distanceZ = localPos.z - closestZ;

        const distanceSquared = (distanceX * distanceX) + (distanceZ * distanceZ);

        if (distanceSquared < (boatRadius * boatRadius)) {
            // Collision detected
            const distance = Math.sqrt(distanceSquared);

            // Normal in local space
            let normalLocal;
            if (distance > 0) {
                normalLocal = new THREE.Vector3(distanceX, 0, distanceZ).divideScalar(distance);
            } else {
                // Center is inside rectangle, push out along smallest axis
                // This is a simplification, ideally we check which face is closest
                const distToRight = halfWidth - localPos.x;
                const distToLeft = localPos.x - (-halfWidth);
                const distToFront = halfDepth - localPos.z;
                const distToBack = localPos.z - (-halfDepth);

                const min = Math.min(distToRight, distToLeft, distToFront, distToBack);

                if (min === distToRight) normalLocal = new THREE.Vector3(1, 0, 0);
                else if (min === distToLeft) normalLocal = new THREE.Vector3(-1, 0, 0);
                else if (min === distToFront) normalLocal = new THREE.Vector3(0, 0, 1);
                else normalLocal = new THREE.Vector3(0, 0, -1);
            }

            // Transform normal back to world space
            const normalWorld = normalLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rectRotation);

            // Penetration depth
            const penetration = boatRadius - distance;

            // Return collision data
            return {
                collided: true,
                normal: normalWorld,
                penetration: penetration
            };
        }

        return { collided: false };
    }
    // OBB vs OBB Collision (Separating Axis Theorem)
    checkOBBCollision(posA: THREE.Vector3, sizeA: THREE.Vector3, rotA: number, posB: THREE.Vector3, sizeB: THREE.Vector3, rotB: number): CollisionResult {
        // 1. Prepare axes
        const a1 = new THREE.Vector3(Math.cos(rotA), 0, -Math.sin(rotA)); // Local X (Right)
        const a2 = new THREE.Vector3(Math.sin(rotA), 0, Math.cos(rotA));  // Local Z (Forward)

        const b1 = new THREE.Vector3(Math.cos(rotB), 0, -Math.sin(rotB));
        const b2 = new THREE.Vector3(Math.sin(rotB), 0, Math.cos(rotB));

        const axes = [a1, a2, b1, b2];

        // 2. Prepare corners (half-extents)
        // We only care about X and Z for 2D collision on water surface
        const hA = { x: sizeA.x / 2, z: sizeA.z / 2 };
        const hB = { x: sizeB.x / 2, z: sizeB.z / 2 };

        let minOverlap = Infinity;
        let smallestAxis: THREE.Vector3 | null = null;

        for (const axis of axes) {
            // Project both OBBs onto the axis

            // Project A
            // Radius of A projected onto axis = sum of projections of half-extents
            // rA = |(a1 dot axis) * hA.x| + |(a2 dot axis) * hA.z|
            // Since a1, a2 are A's basis vectors:
            // a1 dot axis is just cos(angle between a1 and axis)
            // But we computed axis in world space.

            const rA = Math.abs(a1.dot(axis) * hA.x) + Math.abs(a2.dot(axis) * hA.z);
            const rB = Math.abs(b1.dot(axis) * hB.x) + Math.abs(b2.dot(axis) * hB.z);

            // Project distance between centers
            const centerDist = new THREE.Vector3().subVectors(posB, posA).dot(axis);

            // Overlap
            const overlap = (rA + rB) - Math.abs(centerDist);

            if (overlap < 0) {
                return { collided: false }; // Separating axis found
            }

            if (overlap < minOverlap) {
                minOverlap = overlap;
                smallestAxis = axis;
                // Ensure axis points from A to B
                if (centerDist < 0) {
                    smallestAxis = axis.clone().negate();
                }
            }
        }

        // Collision detected
        // Normal should point from B to A? Or A to B?
        // My previous logic used normal pointing OUT of the obstacle (B) towards Boat (A).
        // Here smallestAxis points from A to B (because of the check above).
        // So we want normal = -smallestAxis (B to A).
        const normal = smallestAxis!.clone().negate();

        return {
            collided: true,
            normal: normal,
            penetration: minOverlap
        };
    }

    // OBB vs Circle Collision
    checkOBBvsCircle(obbPos: THREE.Vector3, obbSize: THREE.Vector3, obbRot: number, circlePos: THREE.Vector3, circleRadius: number): CollisionResult {
        // Transform circle center into OBB local space
        const localPos = circlePos.clone().sub(obbPos);
        localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -obbRot);

        // OBB half-extents
        const halfWidth = obbSize.x / 2;
        const halfDepth = obbSize.z / 2;

        // Find closest point on OBB to circle center
        const closestX = Math.max(-halfWidth, Math.min(halfWidth, localPos.x));
        const closestZ = Math.max(-halfDepth, Math.min(halfDepth, localPos.z));

        const closestPointLocal = new THREE.Vector3(closestX, 0, closestZ);

        // Distance from closest point to circle center
        const distanceVec = new THREE.Vector3().subVectors(localPos, closestPointLocal);
        const distanceSquared = distanceVec.lengthSq();

        if (distanceSquared < (circleRadius * circleRadius) || distanceSquared === 0) {
            // Collision
            const distance = Math.sqrt(distanceSquared);

            let normalLocal;
            let penetration;

            if (distance > 0) {
                // Normal points from OBB to Circle
                normalLocal = distanceVec.clone().divideScalar(distance);
                penetration = circleRadius - distance;
            } else {
                // Circle center is inside OBB
                // Push out along smallest axis
                const distToRight = halfWidth - localPos.x;
                const distToLeft = localPos.x - (-halfWidth);
                const distToFront = halfDepth - localPos.z;
                const distToBack = localPos.z - (-halfDepth);

                const min = Math.min(distToRight, distToLeft, distToFront, distToBack);

                if (min === distToRight) normalLocal = new THREE.Vector3(1, 0, 0);
                else if (min === distToLeft) normalLocal = new THREE.Vector3(-1, 0, 0);
                else if (min === distToFront) normalLocal = new THREE.Vector3(0, 0, 1);
                else normalLocal = new THREE.Vector3(0, 0, -1);

                penetration = min + circleRadius;
            }

            // We want normal pointing OUT of the obstacle (Circle) towards the Boat (OBB).
            // normalLocal points OBB -> Circle.
            // So we want -normalLocal.

            const normalWorld = normalLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), obbRot);

            return {
                collided: true,
                normal: normalWorld.negate(), // Point towards OBB (Boat)
                penetration: penetration
            };
        }

        return { collided: false };
    }
}