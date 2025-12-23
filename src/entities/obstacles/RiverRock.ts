import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class RiverRock extends Entity {


    constructor(x: number, y: number, radius: number, physicsEngine: PhysicsEngine) {
        super();

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

        // Graphics: Vertical Rocky Outcrop
        // Cylinder base
        const height = radius * 3.0;
        const geometry = new THREE.CylinderGeometry(radius * 0.3, radius * 1.0, height, 8, 5);
        geometry.name = 'RiverRock';

        const posAttribute = geometry.attributes.position;
        const normalAttribute = geometry.attributes.normal;
        const vertex = new THREE.Vector3();
        const normal = new THREE.Vector3();

        // Deterministic Noise Function (Smoother)
        const noise = (x: number, y: number, z: number) => {
            return Math.sin(x * 1.0) * Math.cos(y * 0.8) * Math.sin(z * 1.0);
        };

        // Seed for this specific rock
        const seedX = Math.random() * 100;
        const seedY = Math.random() * 100;
        const seedZ = Math.random() * 100;


        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);
            normal.fromBufferAttribute(normalAttribute, i);

            // Apply Noise (Reduced amplitude)
            const n = noise(vertex.x + seedX, vertex.y + seedY, vertex.z + seedZ);
            const displacement = n * radius * 0.2;

            // Displace along normal
            vertex.add(normal.clone().multiplyScalar(displacement));

            // No longer extending bottom vertices deep down for Icosahedron,
            // as it's not a vertical cylinder.
            // The original logic for cylinder base extension is removed.

            posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshToonMaterial({ color: 0x808080 });
        material.name = 'RiverRock';

        const mesh = GraphicsUtils.createMesh(geometry, material, 'RiverRockMesh');
        this.meshes.push(mesh);
        // @ts-ignore
        material.flatShading = true; // Works in runtime, types might be strict
        material.needsUpdate = true;

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Random rotation (Y-axis only to keep it vertical)
        mesh.rotation.y = Math.random() * Math.PI * 2;

        // Position: Move up so it sits nicely
        // Center of cylinder is at 0. Height is `height`.
        // We want top to be visible.
        // Water is at 0.
        // If we place mesh at y=0, center is at 0. Top is at height/2. Bottom is at -height/2 (minus extension).
        // This is perfect.
        // Lower it so only the top sticks out
        // Height is 3r. Top is at 1.5r.
        // We want top to be at ~0.5m above water.
        // So shift down by 1.5r - 0.5.
        mesh.position.y = -(height / 2) + 0.5 + (Math.random() * 0.5);

    }

    wasHitByPlayer() {
        // Solid
    }

    update(dt: number) {
        // Static
    }
}
