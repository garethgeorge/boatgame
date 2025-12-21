import * as planck from 'planck';
import { MeshBuilder, StandardMaterial, Color3, Engine, VertexBuffer } from '@babylonjs/core';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { SimplexNoise } from '../../world/SimplexNoise';

export class RiverRock extends Entity {
    private static rockMaterial: StandardMaterial | null = null;

    constructor(x: number, y: number, radius: number, physicsEngine: PhysicsEngine) {
        super();

        const scene = Engine.LastCreatedScene;
        if (!scene) return;

        // Physics: Static
        const physicsBody = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            angle: Math.random() * Math.PI * 2
        });
        this.physicsBodies.push(physicsBody);

        // Circle shape for physics
        physicsBody.createFixture({
            shape: planck.Circle(radius * 0.8),
            friction: 0.5,
            restitution: 0.2
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'rock', entity: this });

        // Graphics
        const height = radius * 4.0;
        const mesh = MeshBuilder.CreateCylinder("rock", {
            diameterTop: radius * 1.5,
            diameterBottom: radius * 2.5,
            height: height,
            tessellation: 12,
            subdivisions: 4
        }, scene);

        // Noise Displacement
        const noise = new SimplexNoise(Math.random() * 100);
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;

        for (let i = 0; i < positions.length; i += 3) {
            const px = positions[i];
            const py = positions[i + 1];
            const pz = positions[i + 2];

            const nx = normals[i];
            const ny = normals[i + 1];
            const nz = normals[i + 2];

            const d = noise.noise3D(px * 0.5, py * 0.2, pz * 0.5) * radius * 0.5;
            positions[i] += nx * d;
            positions[i + 1] += ny * d * 0.2; // Less vertical displacement
            positions[i + 2] += nz * d;
        }
        mesh.setVerticesData(VertexBuffer.PositionKind, positions);

        // Recompute normals for better lighting on displaced mesh
        const vertexData = mesh.getVerticesData(VertexBuffer.PositionKind);
        const indices = mesh.getIndices();
        const newNormals: number[] = [];
        // Babylon compute normals helper? 
        // VertexData.ComputeNormals(positions, indices, newNormals);
        // mesh.setVerticesData(VertexBuffer.NormalKind, newNormals);

        if (!RiverRock.rockMaterial) {
            RiverRock.rockMaterial = new StandardMaterial("rockMat", scene);
            RiverRock.rockMaterial.diffuseColor = Color3.FromHexString("#808080");
            RiverRock.rockMaterial.specularColor = Color3.Black();
        }
        mesh.material = RiverRock.rockMaterial;

        this.meshes.push(mesh);

        // Random rotation
        mesh.rotation.y = Math.random() * Math.PI * 2;

        // Sits mostly under water
        mesh.position.y = -(height / 2) + 1.0 + (Math.random() * 1.0);

        this.sync();
    }

    wasHitByPlayer() {
        // Solid
    }

    update(dt: number) {
        // Static
    }
}
