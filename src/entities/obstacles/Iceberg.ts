import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Iceberg extends Entity {
    declare physicsBody: planck.Body;
    declare mesh: THREE.Group;

    constructor(x: number, y: number, radius: number, physicsEngine: PhysicsEngine) {
        super();

        // Physics: Dynamic but heavy (drifting ice)
        this.physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0, // Water resistance
            angularDamping: 1.0,
            angle: Math.random() * Math.PI * 2
        });

        // Polygon shape for physics (approximate with circle for now for stability, or box?)
        // Circle is best for drifting objects to avoid getting stuck.
        this.physicsBody.createFixture({
            shape: planck.Circle(radius * 0.8),
            density: 10.0, // Heavy ice (5x increase)
            friction: 0.1, // Slippery
            restitution: 0.2
        });

        this.physicsBody.setUserData({ type: 'obstacle', subtype: 'iceberg', entity: this });

        // Graphics: Floating Jagged Ice Sheet
        // Use ExtrudeGeometry for a flat top and jagged perimeter
        const shape = new THREE.Shape();
        const numPoints = 12;
        const angleStep = (Math.PI * 2) / numPoints;

        // Generate random jagged points
        for (let i = 0; i < numPoints; i++) {
            const angle = i * angleStep;
            // Vary radius: 0.7 to 1.3 of base radius
            const r = radius * (0.7 + Math.random() * 0.6);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r; // Shape is in XY plane initially

            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();

        const extrudeSettings = {
            steps: 1,
            depth: 1.5, // Thickness of the ice sheet
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.1,
            bevelSegments: 1
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Center the geometry
        geometry.center();

        const material = new THREE.MeshToonMaterial({
            color: 0xE0F6FF, // Ice Blue
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        // @ts-ignore
        material.flatShading = true;

        this.mesh = new THREE.Group(); // Parent group handles Y-rotation (yaw) from physics
        const innerMesh = new THREE.Mesh(geometry, material);

        // Rotate inner mesh to lie flat on water
        innerMesh.rotation.x = -Math.PI / 2;

        // Position inner mesh
        innerMesh.position.y = 0.2;

        this.mesh.add(innerMesh);

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }

    onHit() {
        // Solid
    }

    update(dt: number) {
        // Drifts naturally
    }
}
