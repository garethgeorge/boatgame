import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class FracturedIceberg extends Entity {
    constructor(
        x: number,
        y: number,
        vertices: { x: number, y: number }[], // Vertices relative to (x,y)
        physicsEngine: PhysicsEngine
    ) {
        super();

        // 1. Physics Body
        // Static body so it cannot be pushed, only collided with
        const body = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            linearDamping: 2.0, // High water resistance
            angularDamping: 2.0,
            allowSleep: true
        });
        this.physicsBodies.push(body);

        // Create Polygon Shape
        // Ensure vertices are CCW? Delaunator usually gives CCW or we can ensure it.
        // Box2D requires CCW.
        const planckVertices = vertices.map(v => planck.Vec2(v.x, v.y));

        body.createFixture({
            shape: planck.Polygon(planckVertices),
            density: 5.0, // Heavy
            friction: 0.3,
            restitution: 0.1
        });

        body.setUserData({ type: Entity.TYPE_OBSTACLE, subtype: 'iceberg', entity: this });

        // 2. Graphics
        const shape = new THREE.Shape();
        if (vertices.length > 0) {
            shape.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
                shape.lineTo(vertices[i].x, vertices[i].y);
            }
            shape.closePath();
        }

        const extrudeSettings = {
            depth: 1.5,
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.1,
            bevelSegments: 1
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        // Center geometry? No, vertices are relative to body center (x,y).
        // Wait, Voronoi polygon vertices are usually absolute coordinates in the layout.
        // If we pass relative vertices, we are good.
        // If we pass absolute vertices, we need to correct.
        // The constructor expects vertices relative to (x,y).

        // Align graphics to physics
        // Physics: X-Y plane (Top Down)
        // Graphics: X-Z plane (3D)
        // Extrude: Creates X-Y geometry.

        // We need a mesh that, when Entity syncs, aligns correctly.
        // Entity.sync():
        // mesh.position.x = body.position.x
        // mesh.position.z = body.position.y (Physics Y -> Graphics Z)
        // mesh.rotation.y = -body.getAngle()

        // So the mesh geometry should be flat on X-Z plane.

        geometry.rotateX(Math.PI / 2); // Now on X-Z
        geometry.translate(0, 0.2, 0); // Float at Y=0.2

        const material = new THREE.MeshToonMaterial({
            color: 0xE0F6FF,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        (material as any).flatShading = true;

        const mesh = GraphicsUtils.createMesh(geometry, material, 'FracturedIceberg');
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.meshes.push(mesh);
    }

    updateLogic(dt: number): void {
        // Passive physics object, no logic needed
    }
}
