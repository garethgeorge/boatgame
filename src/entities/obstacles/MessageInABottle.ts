import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export class MessageInABottle extends Entity {

    static FloatBehavior = class implements EntityBehavior {

        private bottle: MessageInABottle;
        private floatOffset: number = Math.random() * Math.PI * 2;

        constructor(bottle: MessageInABottle) {
            this.bottle = bottle;
        }
        update(dt: number) {
            this.floatOffset += dt * 1.5;
            if (this.bottle.meshes.length > 0) {
                const mesh = this.bottle.meshes[0];
                // Raise by 50% of height (height is ~2.0 now). +1.0 base?
                // User said "float ~50% of it's height heigher".
                // Previous base was implicit 0? No, cylinder center is 0.
                // Let's add +1.0 to y.
                mesh.position.y = Math.sin(this.floatOffset) * 0.1 + 1.0;
                mesh.rotation.y += dt * 0.5;
                mesh.rotation.z = Math.sin(this.floatOffset * 0.5) * 0.2; // Bobbing tilt
            }
        }
    };

    private behavior: EntityBehavior | null = null;
    public points: number;
    public color: number;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, color: number = 0x88FF88, points: number = 100) {
        super();
        this.points = points;
        this.color = color;

        const physicsBody = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y)
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Circle(0.4),
            isSensor: true
        });

        physicsBody.setUserData({ type: 'collectable', subtype: 'bottle', entity: this });

        // Graphics
        const mesh = Decorations.getBottleMesh(color);
        this.meshes.push(mesh);

        // Tilt the whole group
        mesh.rotation.x = Math.PI / 4;
        mesh.rotation.z = Math.PI / 6;

        // Start floating
        this.behavior = new MessageInABottle.FloatBehavior(this);
    }

    update(dt: number) {
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.25, rotateSpeed: 25, targetHeightOffset: 5 });
    }
}
