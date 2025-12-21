import { TransformNode, MeshBuilder, StandardMaterial, Color3, Engine, Mesh } from '@babylonjs/core';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Buoy extends Entity {
    private bobTimer: number = Math.random() * 100;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const scene = Engine.LastCreatedScene;
        if (!scene) return;

        // Physics: Dynamic but high damping to stay mostly in place
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0,
            angularDamping: 2.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Circle(0.5),
            density: 5.0,
            friction: 0.3,
            restitution: 0.5
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'buoy', entity: this });

        // Graphics Root
        const root = new TransformNode("buoy_root", scene);
        this.meshes.push(root);

        const meshesToMergeWood: Mesh[] = [];

        // 1. Striped Base
        // Bottom Red
        const bottom = MeshBuilder.CreateCylinder("bottom", { diameter: 1.0, height: 0.6, tessellation: 12 }, scene);
        bottom.position.y = 0.3;
        const matRed = new StandardMaterial("buoyRed", scene);
        matRed.diffuseColor = Color3.Red();
        matRed.specularColor = Color3.Black();
        bottom.material = matRed;
        bottom.parent = root;

        // Middle White
        const middle = MeshBuilder.CreateCylinder("middle", { diameter: 1.0, height: 0.4, tessellation: 12 }, scene);
        middle.position.y = 0.8;
        const matWhite = new StandardMaterial("buoyWhite", scene);
        matWhite.diffuseColor = Color3.White();
        matWhite.specularColor = Color3.Black();
        middle.material = matWhite;
        middle.parent = root;

        // Top Red
        const top = MeshBuilder.CreateCylinder("top", { diameter: 1.0, height: 0.2, tessellation: 12 }, scene);
        top.position.y = 1.1;
        top.material = matRed;
        top.parent = root;

        // 2. Sensor Top (Black)
        const frame = MeshBuilder.CreateCylinder("frame", { diameterTop: 0.2, diameterBottom: 0.4, height: 0.8, tessellation: 6 }, scene);
        frame.position.y = 1.5;
        const matBlack = new StandardMaterial("buoyBlack", scene);
        matBlack.diffuseColor = new Color3(0.1, 0.1, 0.1);
        matBlack.specularColor = Color3.Black();
        frame.material = matBlack;
        frame.parent = root;

        // 3. Light (Cylindrical glass + emissive dot)
        const lightGlass = MeshBuilder.CreateCylinder("light", { diameter: 0.3, height: 0.2, tessellation: 12 }, scene);
        lightGlass.position.y = 1.9;
        const matGlass = new StandardMaterial("buoyGlass", scene);
        matGlass.diffuseColor = new Color3(1, 1, 0.8);
        matGlass.emissiveColor = new Color3(1, 1, 0.5);
        lightGlass.material = matGlass;
        lightGlass.parent = root;

        this.sync();
    }

    wasHitByPlayer() { }

    update(dt: number) {
        if (this.physicsBodies.length === 0) return;

        // Sync physics position (top-down)
        this.sync();

        // Bobbing animation (visual only, relative to water level)
        this.bobTimer += dt * 2.0;
        const bobOffset = Math.sin(this.bobTimer) * 0.15;
        const tiltIntensity = 0.1;
        const tiltX = Math.sin(this.bobTimer * 0.8) * tiltIntensity;
        const tiltZ = Math.cos(this.bobTimer * 0.7) * tiltIntensity;

        const mesh = this.meshes[0];
        mesh.position.y = bobOffset;
        mesh.rotation.x = tiltX;
        mesh.rotation.z = tiltZ;
    }
}
