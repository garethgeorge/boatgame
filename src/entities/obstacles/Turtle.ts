import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Turtle extends Entity {

    private turnTimer: number = 0;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0,
            angularDamping: 1.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Circle(0.8),
            density: 8.0,
            friction: 0.1
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'turtle', entity: this });

        // Graphics
        const geo = new THREE.SphereGeometry(0.8, 16, 16);
        const mat = new THREE.MeshToonMaterial({ color: 0x006400 }); // Dark Green
        const mesh = new THREE.Mesh(geo, mat);
        this.meshes.push(mesh);

        mesh.scale.y = 0.5; // Flatten it
    }

    onHit() {
        // Turtle dives (disappears)
        this.shouldRemove = true;
    }

    update(dt: number) {
        if (this.physicsBodies.length === 0) {
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.position.y -= dt * 2;
                if (mesh.position.y < -2) {
                    this.shouldRemove = true;
                }
            }
            return;
        }

        // Meander Timer
        this.turnTimer -= dt;
        if (this.turnTimer <= 0) {
            this.turnTimer = Math.random() * 3 + 1;
        }
    }
}
