import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class Turtle extends Entity {


    private behavior: EntityBehavior | null = null;
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
        geo.name = 'Turtle - Shell Geometry';
        const mat = new THREE.MeshToonMaterial({ color: 0x006400, name: 'Turtle - Shell Material' }); // Dark Green
        const mesh = GraphicsUtils.createMesh(geo, mat, 'TurtleMesh');
        this.meshes.push(mesh);

        mesh.scale.y = 0.5; // Flatten it
    }

    wasHitByPlayer() {
        // Turtle dives (disappears)
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    update(dt: number) {
        if (this.behavior) {
            this.behavior.update(dt);
        }

        // Meander Timer
        this.turnTimer -= dt;
        if (this.turnTimer <= 0) {
            this.turnTimer = Math.random() * 3 + 1;
        }
    }
}
