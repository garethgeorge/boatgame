import * as planck from 'planck';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Entity } from '../core/Entity';
import { InputState } from '../managers/InputManager';
import { PhysicsEngine } from '../core/PhysicsEngine';

export class Boat extends Entity {
    declare physicsBody: planck.Body;
    declare mesh: THREE.Group; // Changed to Group for complex model
    private innerMesh: THREE.Group;

    private currentThrottle: number = 0;
    private currentSteering: number = 0;

    private readonly MAX_THRUST = 4000.0; // 2x thrust (was 2000) to match 4x inertia/mass adjustments
    private readonly MAX_STEER_ANGLE = Math.PI / 8; // 22.5 degrees
    private readonly THROTTLE_SPEED = 0.5;
    private readonly STEER_SPEED = 1.0; // Increased to make steering responsive (not sticky)

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const width = 2.4; // Doubled (was 1.2)
        const height = 6.0; // Doubled (was 3.0)

        // Create dynamic body
        this.physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 0.5, // Manual drag
            angularDamping: 8.0, // 4x angular inertia (was 2.0)
            bullet: true
        });

        // Create fixture (shape)
        // Use a Capsule-like shape or multiple circles/boxes to avoid snagging?
        // Planck doesn't have Capsule shape directly, but we can use two circles and a box, or just a box with rounded corners (not built-in).
        // Or just a Box for the middle and Circles for ends.

        // Main body box (slightly shorter)
        this.physicsBody.createFixture({
            shape: planck.Box(width / 2, (height - width) / 2), // Middle section
            density: 5.0, // Reduced density (was 20) so Mass is same as original boat (Area 4x * Density 0.25x = 1x Mass). Inertia is 4x.
            friction: 0.0,
            restitution: 0.0
        });

        // Bow Circle
        this.physicsBody.createFixture({
            shape: planck.Circle(planck.Vec2(0, -(height - width) / 2), width / 2),
            density: 5.0,
            friction: 0.0,
            restitution: 0.0
        });

        // Stern Circle
        this.physicsBody.createFixture({
            shape: planck.Circle(planck.Vec2(0, (height - width) / 2), width / 2),
            density: 5.0,
            friction: 0.0,
            restitution: 0.0
        });

        this.physicsBody.setUserData({ type: 'player', entity: this });

        // Graphics - Tugboat (GLB Model)
        this.mesh = new THREE.Group();
        this.innerMesh = new THREE.Group();
        this.mesh.add(this.innerMesh);

        const loader = new GLTFLoader();
        loader.load('assets/Cute_cartoon_tug_boat_1125002001_texture.glb', (gltf) => {
            const model = gltf.scene;

            // Adjust scale and rotation to match physics body
            // Physics body is approx 2.4 wide x 6.0 long
            // Model scale needs to be determined. Let's start with a reasonable guess and adjust.
            // Usually models are huge or tiny.
            // User requested double size (was 1.5) -> 3.0
            model.scale.set(3.0, 3.0, 3.0);

            // Rotate to face correct direction (Forward is -Z)
            // User requested 180 degree rotation from previous 270 (backwards) -> 90 degrees (Math.PI * 0.5)
            model.rotation.y = Math.PI * 0.5;

            // Adjust vertical position
            // User requested 3/8ths of boat height (0.375)
            const box = new THREE.Box3().setFromObject(model);
            const height = box.max.y - box.min.y;
            model.position.y = height * 0.375;

            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.innerMesh.add(model);
        }, undefined, (error) => {
            console.error('An error occurred loading the boat model:', error);
        });

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }

    update(dt: number, input?: InputState) {
        if (!this.physicsBody || !input) return;

        // --- Input Handling ---

        // Throttle (Sticky)
        if (input.forward) {
            this.currentThrottle = Math.min(1.0, this.currentThrottle + this.THROTTLE_SPEED * dt);
        } else if (input.backward) {
            this.currentThrottle = Math.max(-0.5, this.currentThrottle - this.THROTTLE_SPEED * dt);
        }
        // No decay for throttle - it stays where it is

        // Steering (Auto-center?)
        // User said "turning is too fast". Slowing down STEER_SPEED helps.
        // Did they want sticky steering too? "Also adjust the throttle control -- it should ... stay where it is".
        // Implies steering might be fine auto-centering, just too fast.
        if (input.left) {
            this.currentSteering = Math.min(this.MAX_STEER_ANGLE, this.currentSteering + this.STEER_SPEED * dt);
        } else if (input.right) {
            this.currentSteering = Math.max(-this.MAX_STEER_ANGLE, this.currentSteering - this.STEER_SPEED * dt);
        } else {
            // Decay steering (Auto-center)
            if (this.currentSteering > 0) {
                this.currentSteering = Math.max(0, this.currentSteering - this.STEER_SPEED * dt);
            } else if (this.currentSteering < 0) {
                this.currentSteering = Math.min(0, this.currentSteering + this.STEER_SPEED * dt);
            }
        }

        // --- Physics ---

        const velocity = this.physicsBody.getLinearVelocity();
        const speed = velocity.length();

        // Directions
        const forwardDir = this.physicsBody.getWorldVector(planck.Vec2(0, -1));
        const rightDir = this.physicsBody.getWorldVector(planck.Vec2(1, 0));

        // 1. Drag
        // Project velocity onto local axes
        const forwardSpeed = planck.Vec2.dot(velocity, forwardDir);
        const lateralSpeed = planck.Vec2.dot(velocity, rightDir);

        // Forward Drag (Low)
        const forwardDragCoeff = 2.0; // Increased to 2.0 to balance 2x Thrust
        // Quadratic drag: F = -c * v * |v|
        const forwardDragForce = forwardDir.clone().mul(-forwardDragCoeff * forwardSpeed * Math.abs(forwardSpeed));
        this.physicsBody.applyForceToCenter(forwardDragForce);

        // Lateral Drag (Keel)
        // Reduced from 2.5 to 1.25 to increase drift by 2x
        const lateralDragCoeff = 1.25;
        // Linear or Quadratic? Linear is often more stable for keel effect at low speeds.
        // Let's use linear impulse for "infinite" keel resistance approximation, or strong force.
        // Previous implementation used impulse which is good for "canceling" lateral movement.
        // Let's stick to force for consistency but make it strong.
        const lateralDragForce = rightDir.clone().mul(-lateralDragCoeff * lateralSpeed * this.physicsBody.getMass());
        this.physicsBody.applyForceToCenter(lateralDragForce);

        // Rotational Drag (Angular Damping)
        // We set angularDamping to 2.0 in body, but we can add more based on speed if needed.
        // For now rely on body damping.

        // 2. Thrust & Steering
        // Thrust is applied at the back of the boat.
        // Boat length 3.0. Center 0. Back is +1.5 (local Y).
        // Thrust at back - Reduced from 12.0 to 6.0 to reduce steering authority
        const thrustPosLocal = planck.Vec2(0, 6.0);
        const thrustPosWorld = this.physicsBody.getWorldPoint(thrustPosLocal);

        // Thrust direction: Forward (-Y) rotated by steering angle.
        // Rotation matrix for 2D:
        // x' = x cos - y sin
        // y' = x sin + y cos
        // Forward is (0, -1).
        // Rotated:
        // x = 0 - (-1) * sin(angle) = sin(angle)
        // y = 0 + (-1) * cos(angle) = -cos(angle)
        // Wait, positive steering (Left key) should turn boat Left.
        // If we apply force at BACK of boat:
        // Pushing tail RIGHT turns boat LEFT (nose left).
        // So if steering is positive (Left), we want thrust vector to point slightly Right?
        // Let's visualize.
        // Propeller turns. Thrust vector pushes the boat.
        // If I turn prop Left (steering wheel Left), prop pushes water Back-Right? No, prop pushes water Back-Left?
        // If outboard motor turns Left, the prop points Left. Thrust vector points Forward-Right (pushing boat).
        // Wait, thrust pushes the boat.
        // If I turn wheel Left, engine turns Left. Prop points Left-ish.
        // Thrust pushes boat Forward and... tail moves Right?
        // If engine turns Left, prop pushes water Back-Left. Reaction force on boat is Forward-Right.
        // Force at tail: Forward-Right.
        // Torque: Force X (Right) at Tail (+Y) -> Torque = r cross F = (0, 1.5) cross (F_x, F_y).
        // 1.5 * F_x. If F_x is positive (Right), Torque is negative (Clockwise/Right turn?).
        // Wait.
        // To turn Left (CCW), we need positive Torque.
        // So we need F_x at tail to be negative (Left).
        // So thrust vector should point Forward-Left.
        // So if steering is Positive (Left), Thrust angle should be Positive (Left).

        // Let's calculate local thrust vector.
        // Angle 0 = Forward (0, -1).
        // Rotated by steering angle.
        // x = -sin(angle)
        // y = -cos(angle)
        // If angle > 0 (Left), x is negative (Left).
        // Force at (0, 1.5) is (-sin, -cos).
        // Torque = r x F = 1.5 * (-sin) - 0 * (-cos) = -1.5 * sin.
        // So we need F_x at tail to be Positive (Right).
        // So if steering is Left (>0), we want F_x > 0.
        // So we want thrust vector rotated Right (Negative angle).

        // So effective thrust angle = currentSteering.

        const thrustAngle = this.currentSteering;
        const thrustDirLocal = planck.Vec2(Math.sin(thrustAngle), -Math.cos(thrustAngle));
        const thrustDirWorld = this.physicsBody.getWorldVector(thrustDirLocal);

        const thrustForce = thrustDirWorld.mul(this.currentThrottle * this.MAX_THRUST);

        this.physicsBody.applyForce(thrustForce, thrustPosWorld);

        // Sync Mesh
        const pos = this.physicsBody.getPosition();
        const angle = this.physicsBody.getAngle();

        this.mesh.position.set(pos.x, 0, pos.y);
        this.mesh.rotation.y = -angle;

        // Visual debug of prop?
        // Maybe rotate a part of the mesh if we had one.
    }

    public getThrottle(): number {
        return this.currentThrottle;
    }
}
