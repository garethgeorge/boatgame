import * as planck from 'planck';
import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Log extends Entity {
    // static props removed

    constructor(x: number, y: number, length: number, physicsEngine: PhysicsEngine) {
        super();

        // Log should be perpendicular to the river flow (roughly X-aligned) to block path
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 2.0, // Heavy water resistance
            angularDamping: 1.0,
            bullet: true
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(length / 2, 0.6), // 1.2m thick log
            density: 100.0,
            friction: 0.8,
            restitution: 0.1
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'log', entity: this });

        // Graphics Container
        const root = new TransformNode("logRoot");
        this.meshes.push(root);

        // Actual Log Mesh
        const mesh = MeshBuilder.CreateCylinder("log", { height: length, diameter: 1.2 });
        mesh.parent = root;

        // Materials (Approximation of original Toon materials)
        const logMat = new StandardMaterial("logMat");
        logMat.diffuseColor = Color3.FromHexString("#a87660");
        logMat.specularColor = Color3.Black(); // Matte

        // TODO: Load textures if available, for now colors match the Toon definition
        // const textureLoader = new TextureLoader(); ...
        // We'll stick to colors to avoid asset path guessing unless we verify assets exist.
        // User mentioned "redwood-bark-texture.png".

        mesh.material = logMat;

        // Cylinder is Y-up.
        // Physics Box is length (width) x thickness (height).
        // Log needs to be horizontal.
        // Rotation Z PI/2 aligns Y-cylinder to X-axis.
        mesh.rotation.z = Math.PI / 2;
    }

    wasHitByPlayer() {
        // Logs don't break, they block!
    }

    update(dt: number) {
        // Just floats
    }
}
