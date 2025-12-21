import * as planck from 'planck';
import { TransformNode, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

export class Iceberg extends Entity {


    constructor(x: number, y: number, radius: number, hasBear: boolean, physicsEngine: PhysicsEngine) {
        super();

        // Physics
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0,
            angularDamping: 1.0,
            angle: Math.random() * Math.PI * 2
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Circle(radius * 0.8),
            density: 10.0,
            friction: 0.1,
            restitution: 0.2
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'iceberg', entity: this });

        // Graphics stub
        const mesh = new TransformNode("iceberg");
        this.meshes.push(mesh);

        const ice = MeshBuilder.CreateCylinder("ice", { diameter: radius * 2, height: 1.5, tessellation: 16 });
        const mat = new StandardMaterial("iceMat");
        mat.diffuseColor = Color3.FromHexString("#E0F6FF");
        mat.alpha = 0.9;
        ice.material = mat;
        ice.parent = mesh;

        // Lower it so it sits in the water, not on top. 
        // 0.2 was pushing it UP. We want it DOWN.
        // Height is 1.5. Center is at 0.75.
        // If we want 0.3m above water...
        // Top should be at 0.3. Top is center + 0.75.
        // center + 0.75 = 0.3 => center = -0.45.
        ice.position.y = -0.45;

        if (hasBear) {
            const polarBearData = Decorations.getPolarBear();
            if (polarBearData) {
                polarBearData.model.parent = mesh;
                // Bear needs to sit on top of the ice (y=0.3 relative to water surface)
                // But bear pivot might be at its feet.
                // Mesh pivot is at water surface (0,0,0).
                polarBearData.model.position.y = 0.3;
                polarBearData.model.rotation.y = Math.random() * Math.PI * 2;
            }
        }
    }

    wasHitByPlayer() { }

    update(dt: number) { }
}
