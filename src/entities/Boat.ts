import * as planck from 'planck';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Entity } from '../core/Entity';
import { InputManager } from '../managers/InputManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { Decorations } from '../world/Decorations';
import { CollectedBottles } from './CollectedBottles';
import { MessageInABottle } from './obstacles/MessageInABottle';
import { Pier } from "./obstacles/Pier";
import { GraphicsUtils } from '../core/GraphicsUtils';

export class Boat extends Entity {
    public collectedBottles: CollectedBottles;
    public score: number = 0;
    public fuel: number = 100;

    private innerMesh: THREE.Group;

    private currentThrottle: number = 0;
    private currentSteering: number = 0;
    private smoothedSpeed: number = 0;

    private flashTimer: number = 0;

    // For transfer of bottles to depot
    private lastTransferTime: number = 0;
    private readonly TRANSFER_INTERVAL: number = 1.0; // Seconds

    // Physics Constants
    private readonly MAX_THRUST = 5000.0;
    private readonly MAX_STEER_ANGLE_KEYBOARD = Math.PI / 4; // 45 degrees
    private readonly MAX_STEER_ANGLE_TILT = Math.PI * 75.0 / 180.0; // 75 degrees
    private readonly THROTTLE_SPEED = 1.0;
    private readonly STEER_SPEED = 10.0;

    // At max thrust this is the approx speed reached
    private readonly APPROX_MAX_SPEED = 20.0;

    // For the "fin" effect where the propeller acts like a rudder
    // as a hack increase grip at low speed to get better maneuverability
    private readonly FIN_GRIP_FAST = 100.0;
    private readonly FIN_GRIP_SLOW = 2500.0;

    // Drag Constants
    private readonly DRAG_FORWARD = 4.0; // Low resistance forward 
    private readonly DRAG_SIDEWAYS = 8.0; // High resistance sideways (Keel) 
    private readonly DRAG_ANGULAR = 2.0; // Resistance to rotation 
    private readonly DRAG_ANGULAR_SPEED_FACTOR = 1.0; // Resistance gets higher with speed

    private static instance: Boat | null = null;

    public static getPlayerBody(): planck.Body | null {
        if (!Boat.instance || Boat.instance.physicsBodies.length === 0) return null;
        return Boat.instance.physicsBodies[0];
    }

    public static getBottleCount(): number {
        if (!Boat.instance) return 0;
        return Boat.instance.collectedBottles.count;
    }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();
        Boat.instance = this;

        // Create dynamic body
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 0.0, // We will apply manual drag
            angularDamping: 2.0, // Base angular damping
            bullet: true
        });
        this.physicsBodies.push(physicsBody);

        // Custom Polygon Shape matching the boat image
        // Physics coordinates: Forward is -Y, Right is +X.
        // Boat is approx 2.4m wide, 6.0m long.
        // Vertices must be in Counter-Clockwise (CCW) order
        const vertices = [
            planck.Vec2(0, -3.0),   // Bow (Front)
            planck.Vec2(1.2, -0.5), // Front Right Shoulder
            planck.Vec2(1.2, 2.5),  // Back Right Side
            planck.Vec2(0.9, 3.0),  // Stern Right (Back)
            planck.Vec2(-0.9, 3.0), // Stern Left (Back)
            planck.Vec2(-1.2, 2.5), // Back Left Side
            planck.Vec2(-1.2, -0.5) // Front Left Shoulder
        ];

        physicsBody.createFixture({
            shape: planck.Polygon(vertices),
            density: 20.0,
            friction: 0.1,
            restitution: 0.1
        });

        // Set mass to a standard value for consistent tuning
        const massData = { mass: 500, center: planck.Vec2(0, 0), I: 2000 };
        physicsBody.setMassData(massData);

        physicsBody.setUserData({ type: 'player', entity: this });

        // Graphics - Tugboat (GLB Model)
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        this.innerMesh = new THREE.Group();
        mesh.add(this.innerMesh);

        this.collectedBottles = new CollectedBottles();
        this.innerMesh.add(this.collectedBottles.mesh);
        this.collectedBottles.mesh.scale.set(0.5, 0.5, 0.5);
        this.collectedBottles.mesh.position.set(-0.9, 0.8, 1.6);

        const model = Decorations.getBoat();
        if (model) {

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

            this.innerMesh.add(model);
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    update(dt: number, input?: InputManager) {
        this.collectedBottles.update(dt);
        if (this.physicsBodies.length === 0 || !input) return;
        const physicsBody = this.physicsBodies[0];

        // --- Input Handling ---

        // Throttle (Sticky or Touch)
        // If touch throttle is active (non-zero), use it directly (Spring-loaded)
        if (input.isDown('stop')) {
            this.currentThrottle = 0;
            physicsBody.setLinearVelocity(planck.Vec2(0, 0));
            physicsBody.setAngularVelocity(0);
        } else {
            // Keyboard Control (Sticky)
            if (input.isDown('forward')) {
                this.currentThrottle = Math.min(1.0, this.currentThrottle + this.THROTTLE_SPEED * dt);
            } else if (input.isDown('backward')) {
                this.currentThrottle = Math.max(-0.5, this.currentThrottle - this.THROTTLE_SPEED * dt);
            }
        }

        // Steering (Auto-center)
        // If tilt input is present (non-zero), use it directly (Analog Control)
        if (Math.abs(input.tilt) > 0.05) {
            this.currentSteering = -input.tilt * this.MAX_STEER_ANGLE_TILT;
        } else {
            // Keyboard Control (Digital)
            if (input.isDown('left')) {
                this.currentSteering = Math.min(this.MAX_STEER_ANGLE_KEYBOARD, this.currentSteering + this.STEER_SPEED * dt);
            } else if (input.isDown('right')) {
                this.currentSteering = Math.max(-this.MAX_STEER_ANGLE_KEYBOARD, this.currentSteering - this.STEER_SPEED * dt);
            } else {
                // Decay steering
                if (this.currentSteering > 0) {
                    this.currentSteering = Math.max(0, this.currentSteering - this.STEER_SPEED * dt);
                } else if (this.currentSteering < 0) {
                    this.currentSteering = Math.min(0, this.currentSteering + this.STEER_SPEED * dt);
                }
            }
        }

        this.applyPhysicsForces(physicsBody);

        // --- Visuals Implementation ---

        const velocity = physicsBody.getLinearVelocity();
        const forwardDir = physicsBody.getWorldVector(planck.Vec2(0, -1));
        const forwardSpeed = planck.Vec2.dot(velocity, forwardDir);

        // Sync Mesh Visuals (Tilt/Roll)
        // Base Entity.sync() handles position/rotation for the first body/mesh pair.
        // We just need to handle the visual tilt.

        // Smooth speed for visual stability
        // Use a time-independent lerp factor for smoothing
        const smoothFactor = 1.0 - Math.pow(0.1, dt); // Fast smoothing
        this.smoothedSpeed = THREE.MathUtils.lerp(this.smoothedSpeed, Math.abs(forwardSpeed), smoothFactor);

        // Clamp speed influence
        const speedFactor = Math.min(this.smoothedSpeed / 10.0, 1.0);

        // Pitch: Nose up when moving fast
        const targetPitch = speedFactor * 0.2;

        // Roll: Lean into turn
        const targetRoll = this.currentSteering * speedFactor * 0.5;

        // Smoothly interpolate current rotation to target
        // Use correct time-independent lerp
        const rotLerpFactor = 1.0 - Math.pow(0.001, dt); // Very smooth
        this.innerMesh.rotation.x = THREE.MathUtils.lerp(this.innerMesh.rotation.x, targetPitch, rotLerpFactor);
        this.innerMesh.rotation.z = THREE.MathUtils.lerp(this.innerMesh.rotation.z, targetRoll, rotLerpFactor);

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

    public getThrottle(): number {
        return this.currentThrottle;
    }

    public setThrottle(value: number) {
        this.currentThrottle = Math.max(-1.0, Math.min(1.0, value));
    }

    public teleport(x: number, z: number) {
        if (this.physicsBodies.length > 0) {
            const body = this.physicsBodies[0];
            body.setPosition(planck.Vec2(x, z));
            body.setLinearVelocity(planck.Vec2(0, 0));
            body.setAngularVelocity(0);
            body.setAngle(0); // Face forward (-Z which is physics default or need adjustment?)
            // Boat uses 270 (PI/2 * 3) or 90?
            // "model.rotation.y = Math.PI * 0.5;" in constructor means model is rotated relative to body.
            // Body angle 0 usually means pointing along +X or -Y?
            // "forwardDir = physicsBody.getWorldVector(planck.Vec2(0, -1));"
            // So -Y in physics is forward.
            // Angle 0 -> -1y is (0, -1). Correct.
            // So Angle 0 is fine.
            this.currentThrottle = 0;
            this.currentSteering = 0;

            // Sync immediately to avoid visual glitch?
            this.sync(1.0);
        }
    }

    private applyPhysicsForces(physicsBody: planck.Body) {
        const velocity = physicsBody.getLinearVelocity();
        const angularVelocity = physicsBody.getAngularVelocity();

        // Get local vectors
        const forwardDir = physicsBody.getWorldVector(planck.Vec2(0, -1));
        const rightDir = physicsBody.getWorldVector(planck.Vec2(1, 0));

        // 1. Differential Drag
        // Project velocity onto local axes
        const forwardSpeed = planck.Vec2.dot(velocity, forwardDir);
        const lateralSpeed = planck.Vec2.dot(velocity, rightDir);
        const linearSpeed = velocity.length();

        // Forward Drag (Quadratic) - Air/Water resistance
        // F = -c * v * |v|
        const forwardDragForce = forwardDir.clone().mul(-this.DRAG_FORWARD * forwardSpeed * Math.abs(forwardSpeed));
        physicsBody.applyForceToCenter(forwardDragForce);

        // Lateral Drag (Linear/Quadratic) - Keel resistance
        // Much higher than forward drag to prevent sliding
        const lateralDragForce = rightDir.clone().mul(-this.DRAG_SIDEWAYS * lateralSpeed * physicsBody.getMass());
        physicsBody.applyForceToCenter(lateralDragForce);

        // Angular Drag - Resistance to spinning
        const angularDrag = this.DRAG_ANGULAR + this.DRAG_ANGULAR_SPEED_FACTOR * linearSpeed;
        physicsBody.setAngularDamping(angularDrag);

        // 2. Calculate Motor Details
        // Applied at the stern (back of the boat)
        // Local position: (0, 4.0) roughly (closer to center of mass for better control)
        const motorPosLocal = planck.Vec2(0, 4.0);
        const motorPosWorld = physicsBody.getWorldPoint(motorPosLocal);

        // Thrust Vector (Motor Direction)
        const thrustAngle = this.currentSteering;
        const thrustDirLocal = planck.Vec2(Math.sin(thrustAngle), -Math.cos(thrustAngle));
        const thrustDirWorld = physicsBody.getWorldVector(thrustDirLocal);

        // 3. Fin / Rudder Force (Steerage)
        // Uses the same motor position and orientation
        const finLiftFactor = THREE.MathUtils.smoothstep(linearSpeed, 0.0, this.APPROX_MAX_SPEED);
        const finLiftCoefficient = THREE.MathUtils.lerp(this.FIN_GRIP_SLOW, this.FIN_GRIP_FAST, finLiftFactor);

        // Velocity of water relative to the stern
        const sternVelocity = physicsBody.getLinearVelocityFromLocalPoint(motorPosLocal);

        // 'Right' vector relative to the motor's current orientation
        // Normal is (-u.y, u.x)
        const motorRightNormalLocal = planck.Vec2(-thrustDirLocal.y, thrustDirLocal.x);
        const motorRightNormalWorld = physicsBody.getWorldVector(motorRightNormalLocal);

        // Project stern velocity onto the motor's sideways direction
        const lateralSpeedAtMotor = planck.Vec2.dot(sternVelocity, motorRightNormalWorld);

        // Apply Lift force opposite to that lateral speed
        const finForceMagnitude = -finLiftCoefficient * lateralSpeedAtMotor;
        const finImpulse = motorRightNormalWorld.mul(finForceMagnitude);

        physicsBody.applyForce(finImpulse, motorPosWorld);

        // 4. Outboard Motor Thrust
        if (Math.abs(this.currentThrottle) > 0.01) {
            const thrustForce = thrustDirWorld.mul(this.currentThrottle * this.MAX_THRUST);
            physicsBody.applyForce(thrustForce, motorPosWorld);
        }
    }

    public didHitObstacle(entity: Entity, type: string, subtype: string) {
        if (type === 'obstacle') {
            if (entity.canCausePenalty && !entity.hasCausedPenalty) {
                this.flashRed();
                this.collectedBottles.removeBottle(true); // Lose a bottle
                entity.hasCausedPenalty = true;
            }
        } else if (type === 'collectable') {
            if (subtype === 'bottle') {
                const bottle = entity as MessageInABottle;
                const points = bottle.points;
                const color = bottle.color;
                // delay accounts for the time of the bottle entity animation
                this.collectedBottles.addBottle(color, true, 0.25); // Add a bottle
            }
        }
    }

    public isInContactWithSensor(entity: Entity, type: string, subtype: string, sensor: planck.Fixture) {

        if (this.collectedBottles.count == 0) return;

        if (entity instanceof Pier) {
            const pier = entity as Pier;
            // Check if pier has a depot (and thus a collectedBottles instance)
            if (pier.collectedBottles) {
                const now = Date.now() / 1000;
                const timeSinceLastTransfer = now - this.lastTransferTime;
                if (timeSinceLastTransfer > 10 * this.TRANSFER_INTERVAL) {
                    // Must have just arrived. Wait for first transfer.
                    this.lastTransferTime = now + 1.0;
                } else if (timeSinceLastTransfer > this.TRANSFER_INTERVAL) {
                    // Transfer from Boat to Pier
                    this.collectedBottles.transfer(pier.collectedBottles, true);
                    this.score += 100; // Bonus points for offloading
                    this.lastTransferTime = now;
                }
            }
        }
    }

    private flashRed() {
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

}
