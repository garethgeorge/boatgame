import { MeshBuilder, StandardMaterial, Color3, TransformNode, Engine, Scene, Mesh } from '@babylonjs/core';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export class Turtle extends Entity {
    private static shellMaterial: StandardMaterial | null = null;
    private static skinMaterial: StandardMaterial | null = null;

    private behavior: any | null = null;
    private turnTimer: number = 0;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        const scene = Engine.LastCreatedScene;
        if (!scene) return;

        // Turtles can cause penalties when hit
        this.canCausePenalty = true;

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

        // Graphics Root
        const root = new TransformNode("turtle_root", scene);
        this.meshes.push(root);

        // 1. Shell
        const shell = MeshBuilder.CreateSphere("shell", { diameter: 1.6, segments: 12 }, scene);
        shell.scaling.y = 0.4;
        shell.material = Turtle.getShellMaterial(scene);
        shell.parent = root;

        const skinMeshes: Mesh[] = [];

        // 2. Head
        const head = MeshBuilder.CreateSphere("head", { diameter: 0.5 }, scene);
        head.position.set(0.7, 0, 0);
        skinMeshes.push(head);

        // 3. Flippers
        const flipperData = [
            { pos: [0.5, 0, 0.5], rot: Math.PI / 4 },
            { pos: [0.5, 0, -0.5], rot: -Math.PI / 4 },
            { pos: [-0.5, 0, 0.4], rot: Math.PI * 0.75 },
            { pos: [-0.5, 0, -0.4], rot: -Math.PI * 0.75 }
        ];

        flipperData.forEach(data => {
            const flipper = MeshBuilder.CreateBox("flipper", { width: 0.6, height: 0.1, depth: 0.3 }, scene);
            flipper.position.set(data.pos[0], data.pos[1], data.pos[2]);
            flipper.rotation.y = data.rot;
            skinMeshes.push(flipper);
        });

        const mergedSkin = Mesh.MergeMeshes(skinMeshes, true, true, undefined, false, true);
        if (mergedSkin) {
            mergedSkin.material = Turtle.getSkinMaterial(scene);
            mergedSkin.parent = root;
        }

        root.rotation.y = Math.random() * Math.PI * 2;
        this.sync();
    }

    private static getShellMaterial(scene: Scene): StandardMaterial {
        if (!this.shellMaterial) {
            this.shellMaterial = new StandardMaterial("turtleShell", scene);
            this.shellMaterial.diffuseColor = Color3.FromHexString("#1a4314");
            this.shellMaterial.specularColor = Color3.Black();
        }
        return this.shellMaterial;
    }

    private static getSkinMaterial(scene: Scene): StandardMaterial {
        if (!this.skinMaterial) {
            this.skinMaterial = new StandardMaterial("turtleSkin", scene);
            this.skinMaterial.diffuseColor = Color3.FromHexString("#2d5a27");
            this.skinMaterial.specularColor = Color3.Black();
        }
        return this.skinMaterial;
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
