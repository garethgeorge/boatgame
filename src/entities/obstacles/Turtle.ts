import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Turtle extends Entity {
    declare physicsBody: planck.Body;
    declare mesh: THREE.Mesh;
    private turnTimer: number = 0;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        this.physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0,
            angularDamping: 1.0
        });

        this.physicsBody.createFixture({
            shape: planck.Circle(0.8),
            density: 8.0,
            friction: 0.1
        });

        this.physicsBody.setUserData({ type: 'obstacle', subtype: 'turtle', entity: this });

        // Graphics
        const geo = new THREE.SphereGeometry(0.8, 16, 16);
        const mat = new THREE.MeshToonMaterial({ color: 0x006400 }); // Dark Green
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.scale.y = 0.5; // Flatten it
    }

    onHit() {
        if (this.physicsBody) {
            this.physicsBody.getWorld().destroyBody(this.physicsBody);
            this.physicsBody = null;
        }
    }

    update(dt: number) {
        if (!this.physicsBody) {
            if (this.mesh) {
                this.mesh.position.y -= dt * 2;
                if (this.mesh.position.y < -2) {
                    this.shouldRemove = true;
                }
            }
            return;
        }

        // Meander
        this.turnTimer -= dt;
        if (this.turnTimer <= 0) {
            this.turnTimer = Math.random() * 3 + 1;
            const torque = (Math.random() - 0.5) * 10;
            this.physicsBody.applyTorque(torque);

            // Move forward
            const forward = this.physicsBody.getWorldVector(planck.Vec2(0, -1));
            this.physicsBody.applyForceToCenter(forward.mul(50));
        }
    }
}
