import * as planck from 'planck';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Entity } from '../core/Entity';
import { InputState } from '../managers/InputManager';
import { PhysicsEngine } from '../core/PhysicsEngine';

export class Boat extends Entity {
    declare physicsBody: planck.Body;
    declare mesh: THREE.Group;
    private innerMesh: THREE.Group;

    private currentThrottle: number = 0;
    private currentSteering: number = 0;

    private flashTimer: number = 0;

    // Physics Constants
    private readonly MAX_THRUST = 7500.0; // Tuned for 500kg mass
    private readonly MAX_STEER_ANGLE = Math.PI / 4; // 45 degrees
    private readonly THROTTLE_SPEED = 1.0;
    private readonly STEER_SPEED = 10.0; // Increased from 2.0 to 10.0 (5x) for faster response

    // Drag Constants
    private readonly DRAG_FORWARD = 2.0; // Low resistance forward
    private readonly DRAG_SIDEWAYS = 8.0; // High resistance sideways (Keel)
    private readonly DRAG_ANGULAR = 4.0; // Resistance to rotation

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const width = 2.4;
        const height = 6.0;

        // Create dynamic body
        this.physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 0.0, // We will apply manual drag
            angularDamping: 2.0, // Base angular damping
            bullet: true
        });

        // Main Hull Fixture
        this.physicsBody.createFixture({
            shape: planck.Box(width / 2, (height - width) / 2),
            density: 20.0, // High density for stability
            friction: 0.1,
            restitution: 0.1
        });

        // Bow
        this.physicsBody.createFixture({
            shape: planck.Circle(planck.Vec2(0, -(height - width) / 2), width / 2),
            density: 20.0,
            friction: 0.1,
            restitution: 0.1
        });

        // Stern
        this.physicsBody.createFixture({
            shape: planck.Circle(planck.Vec2(0, (height - width) / 2), width / 2),
            density: 20.0,
            friction: 0.1,
            restitution: 0.1
        });

        // Set mass to a standard value for consistent tuning
        const massData = { mass: 500, center: planck.Vec2(0, 0), I: 2000 };
        this.physicsBody.setMassData(massData);

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

        // Throttle (Sticky or Touch)
        // If touch throttle is active (non-zero), use it directly (Spring-loaded)
        if (Math.abs(input.touchThrottle) > 0.05) {
            this.currentThrottle = input.touchThrottle;
        } else {
            // Keyboard Control (Sticky)
            if (input.forward) {
                this.currentThrottle = Math.min(1.0, this.currentThrottle + this.THROTTLE_SPEED * dt);
            } else if (input.backward) {
                this.currentThrottle = Math.max(-0.5, this.currentThrottle - this.THROTTLE_SPEED * dt);
            }
        }

        // Steering (Auto-center)
        // If tilt input is present (non-zero), use it directly (Analog Control)
        if (Math.abs(input.tilt) > 0.05) {
            // Map tilt (-1 to 1) to max steer angle
            // Tilt Left (Negative?) -> Steer Left (Positive Angle)
            // Let's assume Tilt Left is Negative.
            // Steer Angle: Positive is Left Turn (CCW).
            // So we want: Tilt Left (-1) -> Steer Left (+Max) ??
            // Wait, usually Tilt Left means "Rotate Left".
            // If I tilt phone left, I want boat to turn left.
            // Boat Turn Left = Positive Steering Angle.
            // So if Tilt is Negative, we want Positive Steering?
            // Let's try: Steering = -Tilt * MaxAngle.
            this.currentSteering = -input.tilt * this.MAX_STEER_ANGLE;
        } else {
            // Keyboard Control (Digital)
            if (input.left) {
                this.currentSteering = Math.min(this.MAX_STEER_ANGLE, this.currentSteering + this.STEER_SPEED * dt);
            } else if (input.right) {
                this.currentSteering = Math.max(-this.MAX_STEER_ANGLE, this.currentSteering - this.STEER_SPEED * dt);
            } else {
                // Decay steering
                if (this.currentSteering > 0) {
                    this.currentSteering = Math.max(0, this.currentSteering - this.STEER_SPEED * dt);
                } else if (this.currentSteering < 0) {
                    this.currentSteering = Math.min(0, this.currentSteering + this.STEER_SPEED * dt);
                }
            }
        }

        // --- Physics Implementation ---

        const velocity = this.physicsBody.getLinearVelocity();
        const angularVelocity = this.physicsBody.getAngularVelocity();

        // Get local vectors
        const forwardDir = this.physicsBody.getWorldVector(planck.Vec2(0, -1));
        const rightDir = this.physicsBody.getWorldVector(planck.Vec2(1, 0));

        // 1. Differential Drag
        // Project velocity onto local axes
        const forwardSpeed = planck.Vec2.dot(velocity, forwardDir);
        const lateralSpeed = planck.Vec2.dot(velocity, rightDir);

        // Forward Drag (Quadratic) - Air/Water resistance
        // F = -c * v * |v|
        const forwardDragForce = forwardDir.clone().mul(-this.DRAG_FORWARD * forwardSpeed * Math.abs(forwardSpeed));
        this.physicsBody.applyForceToCenter(forwardDragForce);

        // Lateral Drag (Linear/Quadratic) - Keel resistance
        // Much higher than forward drag to prevent sliding
        const lateralDragForce = rightDir.clone().mul(-this.DRAG_SIDEWAYS * lateralSpeed * this.physicsBody.getMass());
        this.physicsBody.applyForceToCenter(lateralDragForce);

        // Angular Drag - Resistance to spinning
        this.physicsBody.setAngularDamping(this.DRAG_ANGULAR);


        // 2. Outboard Motor Thrust
        // Applied at the stern (back of the boat)
        // Local position: (0, 4.0) roughly (closer to center of mass for better control)
        const motorPosLocal = planck.Vec2(0, 4.0);
        const motorPosWorld = this.physicsBody.getWorldPoint(motorPosLocal);

        // Thrust Vector
        // Rotated by steering angle relative to boat's forward direction
        // Steering Left (positive) -> Thrust vector points Right (pushing stern Right, nose Left)
        // Wait, if I turn engine Left, prop pushes water Back-Left. Reaction on boat is Forward-Right.
        // Force at Stern: Forward-Right.
        // Torque = r x F. r=(0, 2.5). F=(sin, -cos).
        // Torque = 2.5 * sin(theta). Positive torque -> CCW rotation (Left turn). Correct.

        // So: Steering Angle > 0 (Left) -> Thrust Angle > 0 (Rotated Left relative to Forward)
        // Forward is (0, -1).
        // Rotated by theta: (sin(theta), -cos(theta))

        const thrustAngle = this.currentSteering;
        const thrustDirLocal = planck.Vec2(Math.sin(thrustAngle), -Math.cos(thrustAngle));
        const thrustDirWorld = this.physicsBody.getWorldVector(thrustDirLocal);

        // Apply Thrust
        if (Math.abs(this.currentThrottle) > 0.01) {
            const thrustForce = thrustDirWorld.mul(this.currentThrottle * this.MAX_THRUST);
            this.physicsBody.applyForce(thrustForce, motorPosWorld);
        }

        // Sync Mesh
        const pos = this.physicsBody.getPosition();
        const angle = this.physicsBody.getAngle();

        this.mesh.position.set(pos.x, 0, pos.y);
        this.mesh.rotation.y = -angle;

        // Visual Tilt (Pitch & Roll) applied to innerMesh to separate from Physics Yaw
        // Forward Speed -> Nose Up (Positive Pitch)
        // Turning Left -> Roll Right (Negative Roll?)

        // Clamp speed influence
        const speedFactor = Math.min(Math.abs(forwardSpeed) / 10.0, 1.0);

        // Pitch: Nose up when moving fast
        // Max pitch: 15 degrees (0.26 rad)
        const targetPitch = speedFactor * 0.2;

        // Roll: Lean into turn? Or out?
        // Real boats lean OUT (roll away from turn) due to centrifugal force, unless they have a deep keel/banking hull.
        // Let's say lean IN for "arcade" feel or OUT for "tugboat" feel.
        // Tugboat (high CG) leans OUT.
        // Turning Left (Steering > 0) -> Centrifugal force pushes Right -> Boat rolls Right (Positive Z?)
        // Let's try: Steering Left -> Roll Right.
        const targetRoll = this.currentSteering * speedFactor * 0.5;

        // Smoothly interpolate current rotation to target
        const lerpFactor = Math.min(dt * 5.0, 1.0);
        this.innerMesh.rotation.x = THREE.MathUtils.lerp(this.innerMesh.rotation.x, targetPitch, lerpFactor);
        this.innerMesh.rotation.z = THREE.MathUtils.lerp(this.innerMesh.rotation.z, targetRoll, lerpFactor);

        // Flash Effect
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                // Restore original materials (remove emissive)
                this.innerMesh.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                        if (mat && mat.emissive) {
                            mat.emissive.setHex(0x000000);
                        }
                    }
                });
            }
        }
    }

    public flashRed() {
        this.flashTimer = 0.2; // 200ms flash
        this.innerMesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (mat && mat.emissive) {
                    mat.emissive.setHex(0xFF0000);
                    // Ensure intensity is high enough to be seen
                    mat.emissiveIntensity = 1.0;
                }
            }
        });
    }

    public getThrottle(): number {
        return this.currentThrottle;
    }
}
