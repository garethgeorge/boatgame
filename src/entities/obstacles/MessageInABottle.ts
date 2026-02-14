import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../Entity';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { AnimationPlayer } from '../../core/AnimationPlayer';
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
        }

        updatePhysics(dt: number) {
        }

        updateVisuals(dt: number, alpha: number) {
            if (this.bottle.meshes.length > 0) {
                const mesh = this.bottle.meshes[0];
                mesh.position.y = Math.sin(this.floatOffset) * 0.1 + 1.0;
                mesh.rotation.y += dt * 0.5;
                mesh.rotation.z = Math.sin(this.floatOffset * 0.5) * 0.2;
            }
        }

        updateSceneGraph() {
        }
    };

    private behavior: EntityBehavior | null = null;
    public points: number;
    public color: number;
    private player: AnimationPlayer | null = null;

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

        physicsBody.setUserData({ type: Entity.TYPE_COLLECTABLE, subtype: 'bottle', entity: this });

        // Graphics
        const mesh = Decorations.getBottle(color);
        this.meshes.push(mesh);

        // Tilt the whole group
        mesh.rotation.x = Math.PI / 4;
        mesh.rotation.z = Math.PI / 6;

        // Start floating
        this.behavior = new MessageInABottle.FloatBehavior(this);
    }

    updateLogic(dt: number) {
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

    updatePhysics(dt: number) {
        if (this.behavior) {
            this.behavior.updatePhysics(dt);
        }
        super.updatePhysics(dt);
    }

    updateVisuals(dt: number, alpha: number) {
        if (this.behavior) {
            this.behavior.updateVisuals(dt, alpha);
        }
        if (this.player) {
            this.player.update(dt);
        }
        super.updateVisuals(dt, alpha);
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();

        // animates bottle up
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.25, rotateSpeed: 25, targetHeightOffset: 5 });

        // fades bottle out
        if (this.meshes.length > 0) {
            const fadeClip = Decorations.getBottleFadeAnimation();
            if (!fadeClip)
                return;

            const mesh = this.meshes[0];

            // The mesh material are shared, so we need to clone them
            GraphicsUtils.cloneMaterials(mesh);

            // Start fade Animation
            this.player = new AnimationPlayer(mesh as any as THREE.Group, [fadeClip]);
            this.player.play({ name: fadeClip.name, timeScale: 4.0 });
        }
    }

}
