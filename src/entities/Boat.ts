import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../core/Entity';
import { InputState } from '../managers/InputManager';
import { PhysicsEngine } from '../core/PhysicsEngine';

export class Boat extends Entity {
    declare physicsBody: planck.Body;
    declare mesh: THREE.Mesh;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const width = 1.2;
        const height = 3.0;

        // Create dynamic body
        this.physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0,
            angularDamping: 4.0, // High angular drag to prevent spinning
            bullet: true // Prevent tunneling through obstacles at high speed
        });

        // Create fixture (shape)
        // Using a Box for the boat. 
        // Planck Box takes half-width and half-height.
        this.physicsBody.createFixture({
            shape: planck.Box(width / 2, height / 2),
            density: 20.0, // High density to give it mass
            friction: 0.0, // Smooth sliding
            restitution: 0.0 // No bounce
        });

        this.physicsBody.setUserData({ type: 'player', entity: this });

        // Graphics
        const geometry = new THREE.BoxGeometry(width, 1.0, height);
        const material = new THREE.MeshToonMaterial({ color: 0xff4444 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }

    update(dt: number, input?: InputState) {
        if (!this.physicsBody || !input) return;

        // Anisotropic Drag (Water resistance)
        const velocity = this.physicsBody.getLinearVelocity();

        // Forward direction relative to body (assuming local -Y is forward)
        const forwardDir = this.physicsBody.getWorldVector(planck.Vec2(0, -1));
        const rightDir = this.physicsBody.getWorldVector(planck.Vec2(1, 0));

        const forwardSpeed = planck.Vec2.dot(velocity, forwardDir);
        const lateralSpeed = planck.Vec2.dot(velocity, rightDir);

        // Apply strong lateral drag (keel) to prevent drifting
        const lateralDrag = 10.0;
        const lateralImpulse = rightDir.clone().mul(-lateralSpeed * lateralDrag * dt * this.physicsBody.getMass());
        this.physicsBody.applyLinearImpulse(lateralImpulse, this.physicsBody.getWorldCenter());

        const forceMagnitude = 1500.0;
        const torqueMagnitude = 500.0;

        if (input.forward) {
            const force = forwardDir.clone().mul(forceMagnitude);
            this.physicsBody.applyForceToCenter(force);
        } else if (input.backward) {
            const force = forwardDir.clone().mul(-forceMagnitude * 0.5);
            this.physicsBody.applyForceToCenter(force);
        }

        if (input.left) {
            this.physicsBody.applyTorque(-torqueMagnitude);
        } else if (input.right) {
            this.physicsBody.applyTorque(torqueMagnitude);
        }

        // Sync Mesh
        const pos = this.physicsBody.getPosition();
        const angle = this.physicsBody.getAngle();

        this.mesh.position.set(pos.x, 0, pos.y);
        this.mesh.rotation.y = -angle;
    }
}
