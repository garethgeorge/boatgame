import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../Entity';
import { PhysicsEngine, CollisionCategories } from '../../core/PhysicsEngine';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class GasCan extends Entity {

    static FloatBehavior = class implements EntityBehavior {

        private gasCan: GasCan;
        private floatOffset: number = Math.random() * Math.PI * 2;

        constructor(gasCan: GasCan) {
            this.gasCan = gasCan;
        }
        update(dt: number) {
            // Float animation
            this.floatOffset += dt * 2;
        }

        updatePhysics(dt: number) {
        }

        updateVisuals(dt: number, alpha: number) {
            if (this.gasCan.meshes.length > 0) {
                const mesh = this.gasCan.meshes[0];
                mesh.position.y = Math.sin(this.floatOffset) * 0.2 + 0.5; // +0.5 base height
                mesh.rotation.y += dt;
            }
        }

        updateSceneGraph() {
        }
    };

    private behavior: EntityBehavior | null = null;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const physicsBody = physicsEngine.world.createBody({
            type: 'static', // Static sensor
            position: planck.Vec2(x, y)
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(0.5, 0.5),
            isSensor: true,
            filterCategoryBits: CollisionCategories.COLLECTABLE
        });

        physicsBody.setUserData({ type: Entity.TYPE_COLLECTABLE, subtype: 'gas', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Main Body
        const geo = new THREE.BoxGeometry(1.2, 1.6, 0.8); // Doubled
        geo.name = 'GasCan - Body Geometry';
        const mat = new THREE.MeshToonMaterial({ color: 0xFF0000, name: 'GasCan - Material' }); // Red
        const can = GraphicsUtils.createMesh(geo, mat, 'GasCanBody');
        can.position.y = 0.8;
        mesh.add(can);

        // Handle
        const handleGeo = new THREE.TorusGeometry(0.3, 0.1, 8, 16); // Doubled
        handleGeo.name = 'GasCan - Handle Geometry';
        const handleMat = new THREE.MeshToonMaterial({ color: 0xFF0000, name: 'GasCan - Handle Material' });
        const handle = GraphicsUtils.createMesh(handleGeo, handleMat, 'GasCanHandle');
        handle.position.y = 1.8;
        // Fix rotation: was Math.PI / 2 (90 deg), user says off by 90.
        // Torus default is flat on XY plane.
        // If we want it upright like a suitcase handle?
        // Let's try 0 or PI.
        handle.rotation.y = 0;
        mesh.add(handle);

        // Spout
        const spoutGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.6, 8); // Doubled
        spoutGeo.name = 'GasCan - Spout Geometry';
        const spoutMat = new THREE.MeshToonMaterial({ color: 0xFFD700, name: 'GasCan - Spout Material' }); // Yellow
        const spout = GraphicsUtils.createMesh(spoutGeo, spoutMat, 'GasCanSpout');
        spout.position.set(0.4, 1.6, 0);
        spout.rotation.z = -Math.PI / 4;
        mesh.add(spout);

        // Start floating
        this.behavior = new GasCan.FloatBehavior(this);
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
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
    }

    updateVisuals(dt: number, alpha: number) {
        if (this.behavior) {
            this.behavior.updateVisuals(dt, alpha);
        }
        super.updateVisuals(dt, alpha);
    }
}
