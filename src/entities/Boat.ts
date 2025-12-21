import * as planck from 'planck';
import {
    TransformNode,
    Vector3,
    Mesh,
    StandardMaterial,
    Color3,
    Scalar,
    AbstractMesh
} from '@babylonjs/core';
import { Entity } from '../core/Entity';
import { InputManager } from '../managers/InputManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { Decorations } from '../world/Decorations';
import { CollectedBottles } from './CollectedBottles';
import { MessageInABottle } from './obstacles/MessageInABottle';
import { Pier } from "./obstacles/Pier";

export class Boat extends Entity {
    public collectedBottles: CollectedBottles;
    public score: number = 0;
    public fuel: number = 100;

    private innerMesh: TransformNode;

    private currentThrottle: number = 0;
    private currentSteering: number = 0;
    private smoothedSpeed: number = 0;

    private flashTimer: number = 0;

    // For transfer of bottles to depot
    private lastTransferTime: number = 0;
    private readonly TRANSFER_INTERVAL: number = 1.0; // Seconds

    // Physics Constants
    private readonly MAX_THRUST = 50000.0; // Significant power
    private readonly MAX_STEER_ANGLE_KEYBOARD = Math.PI / 12; // 15 degrees (Reduced 4x from 60)
    private readonly MAX_STEER_ANGLE_TILT = Math.PI / 8; // 22.5 degrees (Reduced 4x from 90)
    private readonly THROTTLE_SPEED = 2.0;
    private readonly STEER_SPEED = 5.0;

    // Drag Constants
    private readonly DRAG_FORWARD = 2.0; // Low resistance forward 
    private readonly DRAG_SIDEWAYS = 20.0; // High resistance sideways (Keel) 
    private readonly DRAG_ANGULAR = 5.0; // High angular drag to prevent spinning

    private static instance: Boat | null = null;

    public static getPlayerBody(): planck.Body | null {
        if (!Boat.instance || Boat.instance.physicsBodies.length === 0) return null;
        return Boat.instance.physicsBodies[0];
    }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();
        Boat.instance = this;

        // Create dynamic body
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0, // Increased base damping
            angularDamping: 4.0, // Increased angular damping
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
        // Root node
        const mesh = new TransformNode("boatRoot");
        this.meshes.push(mesh); // Assuming Entity.meshes now holds TransformNode

        // Inner mesh for visual roll/pitch separation
        this.innerMesh = new TransformNode("boatInner");
        this.innerMesh.parent = mesh;

        this.collectedBottles = new CollectedBottles();
        this.collectedBottles.mesh.parent = this.innerMesh;
        this.collectedBottles.mesh.scaling.set(0.5, 0.5, 0.5);
        this.collectedBottles.mesh.position.set(-0.9, 0.8, 1.6); // Babylon uses same coords as Three mostly?
        // Note: Babylon coordinate system is Left-Handed usually, but check GraphicsEngine.
        // We set up GraphicsEngine to use Right-Handed to match Three.js (if I recall correctly).
        // Phase 1 summary said "Configured for right-handed coordinate system".

        const model = Decorations.getBoat();
        if (model) {

            // Adjust scale and rotation to match physics body
            // Physics body is approx 2.4 wide x 6.0 long
            // Model scale needs to be determined. Let's start with a reasonable guess and adjust.
            // Usually models are huge or tiny.
            // User requested double size (was 1.5) -> 3.0
            model.scaling.set(3.0, 3.0, 3.0);

            // Rotate to face correct direction (Forward is -Z)
            // User requested 180 degree rotation from previous 270 (backwards) -> 90 degrees (Math.PI * 0.5)
            model.rotation.y = Math.PI * 0.5;

            // Adjust vertical position
            // User requested 3/8ths of boat height (0.375)
            // Compute bounding box height.
            // Babylon calculate hierarchy bounding vectors
            const hierarchy = model.getHierarchyBoundingVectors();
            // hierarchy returns absolute min/max. But model is at 0,0,0 if not parented?
            // Actually it's newly created.
            // Local bounds are better.
            const height = hierarchy.max.y - hierarchy.min.y;

            model.position.y = height * 0.375;

            // Wait, getHierarchyBoundingVectors works in world space usually.
            // If model is not in scene yet or parented, it might rely on its current world matrix.
            // Since it's from a factory, it might be at origin.
            // Let's assume height calculation is roughly correct or adjust manually if needed.

            model.parent = this.innerMesh;
        }

        // Shadows handled by Light/Generator, specific mesh flags (castShadow) handled on mesh creation usually.
        // In Babylon: shadowGenerator.getShadowMap().renderList.push(mesh);
        // Entity doesn't handle shadow registration automatically.
        // We might need to handle this in GraphicsEngine or pass a flag.
        // For now, ignore shadow casting flags until we fix lighting.
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
        this.smoothedSpeed = Scalar.Lerp(this.smoothedSpeed, Math.abs(forwardSpeed), smoothFactor);

        // Clamp speed influence
        const speedFactor = Math.min(this.smoothedSpeed / 10.0, 1.0);

        // Pitch: Nose up when moving fast
        const targetPitch = speedFactor * 0.2;

        // Roll: Lean into turn
        const targetRoll = this.currentSteering * speedFactor * 0.5;

        // Smoothly interpolate current rotation to target
        // Use correct time-independent lerp
        const rotLerpFactor = 1.0 - Math.pow(0.001, dt); // Very smooth

        // Babylon uses rotation (Vector3 Euler)
        if (!this.innerMesh.rotation) this.innerMesh.rotation = new Vector3(0, 0, 0);

        this.innerMesh.rotation.x = Scalar.Lerp(this.innerMesh.rotation.x, targetPitch, rotLerpFactor);
        this.innerMesh.rotation.z = Scalar.Lerp(this.innerMesh.rotation.z, targetRoll, rotLerpFactor);

        // Flash Effect
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                // Restore original materials (remove emissive)
                const meshes = this.innerMesh.getChildMeshes();
                for (const m of meshes) {
                    if (m.material && m.material instanceof StandardMaterial) {
                        m.material.emissiveColor = new Color3(0, 0, 0);
                        // Disable emissive if originally unset?
                        // StandardMaterial default is black (no emission).
                    }
                }
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
            body.setAngle(0);

            this.currentThrottle = 0;
            this.currentSteering = 0;

            // Sync immediately to avoid visual glitch?
            this.sync(1.0);
        }
    }

    private applyPhysicsForces(physicsBody: planck.Body) {
        const velocity = physicsBody.getLinearVelocity();
        // const angularVelocity = physicsBody.getAngularVelocity();

        // Get local vectors
        const forwardDir = physicsBody.getWorldVector(planck.Vec2(0, -1));
        const rightDir = physicsBody.getWorldVector(planck.Vec2(1, 0));

        // 1. Local Drag (Simulate Keel & Water Resistance)
        // Project velocity onto local axes
        const forwardSpeed = planck.Vec2.dot(velocity, forwardDir);
        const lateralSpeed = planck.Vec2.dot(velocity, rightDir);

        // Forward Drag: Low friction for efficient movement
        // Quadratic drag: F = -c * v * |v|
        const forwardDragForce = forwardDir.clone().mul(-this.DRAG_FORWARD * forwardSpeed);
        physicsBody.applyForceToCenter(forwardDragForce);

        // Lateral Drag: High friction (Keel) to prevent sliding
        // Linear usually feels tighter for keels at low speed, but let's use simple high damping
        const lateralDragForce = rightDir.clone().mul(-this.DRAG_SIDEWAYS * lateralSpeed * physicsBody.getMass() * 5.0);
        physicsBody.applyForceToCenter(lateralDragForce);

        // Angular Drag: Dampen spinning
        physicsBody.setAngularDamping(this.DRAG_ANGULAR);

        // 2. Offset Thrust (Steering via Torque)
        // Engine is at the Stern (Back of boat)
        // Boat Center is (0,0). Stern is approx (0, 3.0).
        // Apply force slightly behind to ensure good lever arm.
        const rudderPosLocal = planck.Vec2(0, 3.5);
        const rudderPosWorld = physicsBody.getWorldPoint(rudderPosLocal);

        // Calculate Thrust Force Vector
        // We want to turn RIGHT (Positive Steering):
        // Stern kicks LEFT (Negative X locally).
        // Force Vector X component should be -Math.sin(angle).
        // Force Vector Y component is propulsion (Forward is -Y), so -Math.cos(angle).

        if (Math.abs(this.currentThrottle) > 0.01) {
            const angle = this.currentSteering;
            const thrustDirLocal = planck.Vec2(-Math.sin(angle), -Math.cos(angle));
            const thrustDirWorld = physicsBody.getWorldVector(thrustDirLocal);

            const thrustForce = thrustDirWorld.mul(this.currentThrottle * this.MAX_THRUST);
            physicsBody.applyForce(thrustForce, rudderPosWorld);
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
        const meshes = this.innerMesh.getChildMeshes();
        for (const m of meshes) {
            if (m.material && m.material instanceof StandardMaterial) {
                m.material.emissiveColor = new Color3(1, 0, 0); // Red
                // Babylon StandardMaterial uses emissiveColor
            }
        }
    }

}
