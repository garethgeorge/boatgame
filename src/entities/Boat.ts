import Matter from 'matter-js';
import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { InputState } from '../managers/InputManager';

export class Boat extends Entity {
    constructor(x: number, y: number) {
        super();

        // Physics
        const width = 1.2;
        const height = 3.0; // Length in 3D, height in 2D top-down

        // Create a boat shape (pointed front)
        // Vertices relative to center (0,0)
        // Front is -y (in 2D physics space, which maps to -z in 3D world)
        // Wait, boat moves in -Z direction.
        // In Physics (2D):
        // Forward force is applied as (0, -1). So -Y is forward.
        // So the "Front" of the boat should be at negative Y.

        const vertices = [
            { x: 0, y: -height / 2 },          // Bow (Front tip)
            { x: width / 2, y: -height / 4 },  // Front Right
            { x: width / 2, y: height / 2 },   // Back Right
            { x: -width / 2, y: height / 2 },  // Back Left
            { x: -width / 2, y: -height / 4 }  // Front Left
        ];

        this.physicsBody = Matter.Bodies.fromVertices(x, y, [vertices], {
            frictionAir: 0.05, // Water resistance (high drag)
            friction: 0.0, // Collision friction (smooth sliding)
            frictionStatic: 0.0, // No stickiness
            restitution: 0.0, // No bounce
            density: 0.001, // Default density
        });

        // Set realistic mass (e.g., 500kg for a small boat)
        Matter.Body.setMass(this.physicsBody, 500);

        // Graphics
        const geometry = new THREE.BoxGeometry(width, 1.0, height);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }

    update(dt: number, input?: InputState) {
        if (!this.physicsBody || !input) return;

        // Forces need to be scaled by mass to be effective
        // F = ma. If we want a = 5 m/s^2, F = 500 * 5 = 2500.
        // However, Matter.js forces are applied per step.
        // Let's try a force magnitude that feels right.
        const forceMagnitude = 0.125; // Reduced 4x from 0.5 based on user feedback
        const torqueMagnitude = 0.04; // Reduced another 25x (Total 625x reduction from original)

        // Forward/Backward
        if (input.forward) {
            const force = {
                x: Math.sin(this.physicsBody.angle) * forceMagnitude,
                y: -Math.cos(this.physicsBody.angle) * forceMagnitude // -y is forward in 2D top-down if 0 angle is up
            };
            // Actually, let's verify orientation. 
            // If angle 0 is "up" (negative Y), then:
            // sin(0) = 0, -cos(0) = -1. Correct.
            Matter.Body.applyForce(this.physicsBody, this.physicsBody.position, force);
        } else if (input.backward) {
            const force = {
                x: -Math.sin(this.physicsBody.angle) * forceMagnitude * 0.5,
                y: Math.cos(this.physicsBody.angle) * forceMagnitude * 0.5
            };
            Matter.Body.applyForce(this.physicsBody, this.physicsBody.position, force);
        }

        // Steering
        if (input.left) {
            this.physicsBody.torque = -torqueMagnitude;
        } else if (input.right) {
            this.physicsBody.torque = torqueMagnitude;
        }
    }
}
