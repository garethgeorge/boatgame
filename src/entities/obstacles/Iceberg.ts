import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../Entity';
import { PhysicsEngine, CollisionCategories } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { TerrainMap, Zone } from '../behaviors/TerrainMap';
import { ConvexHull } from '../../core/ConvexHull';
import { Polygon } from '../../core/Polygon';

export class Iceberg extends Entity {
    private animationMixer?: THREE.AnimationMixer;
    private terrainMap: TerrainMap;

    constructor(x: number, y: number, radius: number, hasBear: boolean, physicsEngine: PhysicsEngine) {
        super();

        // Physics: Dynamic but heavy (drifting ice)
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0, // Water resistance
            angularDamping: 1.0,
            angle: Math.random() * Math.PI * 2
        });
        this.physicsBodies.push(physicsBody);

        // Graphics: Floating Jagged Ice Sheet
        // Use ExtrudeGeometry for a flat top and jagged perimeter
        const shape = new THREE.Shape();
        const numPoints = 8; // Max 8 for Box2D polygon
        const angleStep = (Math.PI * 2) / numPoints;
        const vertices: planck.Vec2[] = [];

        // Generate random jagged points
        for (let i = 0; i < numPoints; i++) {
            const angle = i * angleStep;
            // Vary radius: 0.7 to 1.3 of base radius
            const r = radius * (0.7 + Math.random() * 0.6);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r; // Shape is in XY plane initially

            vertices.push(planck.Vec2(x, y));

            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();

        // Polygon shape for physics (Convex Hull for safety)
        const hullVertices = ConvexHull.computeVec2(vertices);
        physicsBody.createFixture({
            shape: planck.Polygon(hullVertices),
            density: 10.0, // Heavy ice (5x increase)
            friction: 0.1, // Slippery
            restitution: 0.2,
            filterCategoryBits: CollisionCategories.OBSTACLE
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'iceberg', entity: this });

        const extrudeSettings = {
            steps: 1,
            depth: 1.5, // Thickness of the ice sheet
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.1,
            bevelSegments: 1
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.name = 'Iceberg - Geometry';

        // DO NOT center the geometry. Visual origin (0,0) must match Physics origin.
        // geometry.center();

        const material = new THREE.MeshToonMaterial({
            name: 'Iceberg - Material',
            color: 0xE0F6FF, // Ice Blue
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        // @ts-ignore
        material.flatShading = true; // Works in runtime
        material.needsUpdate = true;

        const mesh = new THREE.Group(); // Parent group handles Y-rotation (yaw) from physics
        this.meshes.push(mesh);

        const innerMesh = GraphicsUtils.createMesh(geometry, material, 'IcebergInner');

        // Rotate inner mesh to lie flat on water
        // Rot X +90 deg:
        // Local Z (extrusion depth) -> World -Y (Down)
        // Local Y (Shape Y) -> World +Z (Depth/Forward) matches Physics Y
        // Local X (Shape X) -> World +X (Width) matches Physics X
        innerMesh.rotation.x = Math.PI / 2;

        // Position inner mesh
        // Top surface is at local Z=0 (start of extrusion).
        // Rotated, it's at local Y=0.
        // We want top surface slightly above water (0.2).
        innerMesh.position.y = 0.2;

        mesh.add(innerMesh);

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Add polar bear decoration
        if (hasBear) {
            const polarBearData = Decorations.getPolarBear();
            if (polarBearData) {
                const { model, animations } = polarBearData;

                // Position the polar bear on top of the iceberg
                model.position.y = 0.5; // Lower slightly to be on surface
                model.scale.set(3.0, 3.0, 3.0);
                model.rotation.y = Math.random() * Math.PI * 2; // Random rotation

                // Reparent to innerMesh so it follows the tilt/rotation?
                // No, innerMesh is rotated X=90. Bear expects Y-up.
                // Bear should be child of 'mesh' (the yaw group).
                // 'mesh' is at (x,0,z).

                // But we want it relative to the visual ice surface?
                // Ice top surface is at Y=0.2 world space.
                // 1.0 might be too high if model origin is at feet.

                mesh.add(model);

                // Play animation if available
                if (animations.length > 0) {
                    this.animationMixer = new THREE.AnimationMixer(model);
                    const action = this.animationMixer.clipAction(animations[0]);
                    action.time = Math.random() * action.getClip().duration;
                    action.play();
                }
            }
        }

        this.terrainMap = new IcebergTerrainMap(vertices, 0.2);
    }

    wasHitByPlayer() {
        // Solid
    }

    updateLogic(dt: number) {
        // Update animation mixer if present
        if (this.animationMixer) {
            this.animationMixer.update(dt);
        }
        // Drifts naturally
    }

    getTerrainMap(): TerrainMap {
        return this.terrainMap;
    }

}

export class IcebergTerrainMap implements TerrainMap {
    private polygon: Polygon;
    private iceHeight: number;

    constructor(vertices: planck.Vec2[], iceHeight: number) {
        this.polygon = new Polygon(vertices);
        this.iceHeight = iceHeight;
    }

    sample(x: number, z: number, waterHeight: number, margin: number): { y: number; normal: THREE.Vector3; zone: Zone; } {
        const point = planck.Vec2(x, z);
        const inside = this.polygon.containsPoint(point);

        let y = this.iceHeight;
        let zone: Zone = 'land';

        if (inside) {
            y = this.iceHeight;
            zone = 'land';
        } else {
            const dist = this.polygon.distanceToPoint(point);
            if (dist < margin) {
                const t = dist / margin;
                y = this.iceHeight * (1 - t) + waterHeight * t;
                zone = 'margin';
            } else {
                y = waterHeight;
                zone = 'water';
            }
        }

        return { y, normal: new THREE.Vector3(0, 1, 0), zone };
    }
}
