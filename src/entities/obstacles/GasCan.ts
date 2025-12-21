import * as planck from 'planck';
import { TransformNode, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export class GasCan extends Entity {

    static FloatBehavior = class {

        private gasCan: GasCan;
        private floatOffset: number = Math.random() * Math.PI * 2;

        constructor(gasCan: GasCan) {
            this.gasCan = gasCan;
        }
        update(dt: number) {
            // Float animation
            this.floatOffset += dt * 2;
            if (this.gasCan.meshes.length > 0) {
                const mesh = this.gasCan.meshes[0];
                mesh.position.y = Math.sin(this.floatOffset) * 0.2 + 0.5; // +0.5 base height
                mesh.rotation.y += dt;
            }
        }
    };

    private behavior: any | null = null;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const physicsBody = physicsEngine.world.createBody({
            type: 'static', // Static sensor
            position: planck.Vec2(x, y)
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(0.5, 0.5),
            isSensor: true
        });

        physicsBody.setUserData({ type: 'collectable', subtype: 'gas', entity: this });

        // Graphics
        const mesh = new TransformNode("gasCan");
        this.meshes.push(mesh);

        // Main Body
        const can = MeshBuilder.CreateBox("canBody", { width: 1.2, height: 1.6, depth: 0.8 });
        const mat = new StandardMaterial("canMat");
        mat.diffuseColor = Color3.Red();
        can.material = mat;
        can.position.y = 0.8;
        can.parent = mesh;

        // Handle
        const handle = MeshBuilder.CreateTorus("handle", { diameter: 0.6, thickness: 0.1, tessellation: 16 });
        handle.material = mat; // Reuse red
        handle.position.y = 1.8;
        handle.rotation.x = Math.PI / 2; // Flat on top? No, upright. Default Torus is flat on XZ. Rotate X 90 to stand up in XY or ZY? 
        // Suitcase handle usually upright.
        handle.parent = mesh;

        // Spout
        const spout = MeshBuilder.CreateCylinder("spout", { diameterTop: 0.1, diameterBottom: 0.16, height: 0.6 });
        const spoutMat = new StandardMaterial("spoutMat");
        spoutMat.diffuseColor = Color3.Yellow();
        spout.material = spoutMat;
        spout.position.set(0.4, 1.6, 0);
        spout.rotation.z = -Math.PI / 4;
        spout.parent = mesh;

        // Start floating
        this.behavior = new GasCan.FloatBehavior(this);
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    update(dt: number) {
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }
}
