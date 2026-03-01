import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../Entity';
import { PhysicsEngine, CollisionCategories } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { TerrainMap, Zone, SurfaceInfo, ShoreInfo } from '../behaviors/TerrainMap';
import { ConvexHull } from '../../core/ConvexHull';
import { Polygon } from '../../core/Polygon';
import { RiverSystem } from '../../world/RiverSystem';

export class Iceberg extends Entity {
    private animationMixer?: THREE.AnimationMixer;
    private terrainMap: TerrainMap;

    constructor(x: number, y: number, radius: number, physicsEngine: PhysicsEngine) {
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

        this.terrainMap = new IcebergTerrainMap(this, vertices, 0.55);
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
    private iceberg: Entity;
    private polygon: Polygon;
    private iceHeight: number;

    constructor(iceberg: Entity, vertices: planck.Vec2[], iceHeight: number) {
        this.iceberg = iceberg;
        this.polygon = new Polygon(vertices);
        this.iceHeight = iceHeight;
    }

    private getLocalPoint(x: number, z: number): planck.Vec2 {
        const body = this.iceberg.physicsBodies[0];
        if (body) {
            return body.getLocalPoint(planck.Vec2(x, z));
        }
        return planck.Vec2(x, z);
    }

    public getSurfaceInfo(x: number, z: number): SurfaceInfo {
        const point = this.getLocalPoint(x, z);
        const inside = this.polygon.containsPoint(point);

        let surfaceY = 0;
        let normal = new THREE.Vector3(0, 1, 0);

        if (inside) {
            const mesh = this.iceberg.meshes[0];
            if (mesh) {
                const worldPos = new THREE.Vector3(0, this.iceHeight, 0);
                mesh.localToWorld(worldPos);
                surfaceY = worldPos.y;

                normal.applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
            } else {
                surfaceY = this.iceHeight;
            }
        }

        return {
            y: surfaceY,
            normal: normal,
            zone: inside ? 'land' : 'water'
        };
    }

    public getZone(
        x: number, z: number, radius: number
    ): { zone: Zone, t: number } {
        const point = this.getLocalPoint(x, z);
        const isInsideIceberg = this.polygon.containsPoint(point);
        const absDistance = this.polygon.distanceToPoint(point);
        const signedWaterDistance = isInsideIceberg ? -absDistance : absDistance;

        let t = 0;
        if (radius > 0) {
            t = Math.max(-1, Math.min(1, signedWaterDistance / radius));
        } else {
            t = signedWaterDistance > 0 ? 1 : signedWaterDistance < 0 ? -1 : 0;
        }

        let zone: Zone = 'margin';
        if (signedWaterDistance >= radius) {
            zone = 'water';
        } else if (signedWaterDistance <= -radius) {
            zone = 'land';
        }

        return { zone, t };
    }

    public getNearestShoreline(x: number, z: number): ShoreInfo {
        const point = this.getLocalPoint(x, z);
        const vertices = (this.polygon as any).vertices as planck.Vec2[];
        let minDistanceSq = Infinity;
        let closestPoint = planck.Vec2(0, 0);
        let segmentNormal = new THREE.Vector2(0, 0);

        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const v1 = vertices[i];
            const v2 = vertices[j];

            const l2 = planck.Vec2.distanceSquared(v1, v2);
            let t = 0;
            if (l2 !== 0) {
                t = ((point.x - v1.x) * (v2.x - v1.x) + (point.y - v1.y) * (v2.y - v1.y)) / l2;
                t = Math.max(0, Math.min(1, t));
            }
            const proj = planck.Vec2(v1.x + t * (v2.x - v1.x), v1.y + t * (v2.y - v1.y));
            const distSq = planck.Vec2.distanceSquared(point, proj);

            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestPoint = proj;

                const dx = v2.x - v1.x;
                const dy = v2.y - v1.y;
                // Assuming ConvexHull generates CCW vertices, right-hand normal points outwards
                segmentNormal = new THREE.Vector2(dy, -dx).normalize();
            }
        }

        const distance = this.polygon.containsPoint(point) ? -Math.sqrt(minDistanceSq) : Math.sqrt(minDistanceSq);
        const position = new THREE.Vector2(closestPoint.x, closestPoint.y);
        const direction = new THREE.Vector2(segmentNormal.y, -segmentNormal.x);

        // Transform normal, direction, and position back to global space
        const body = this.iceberg.physicsBodies[0];
        if (body) {
            const worldPos = body.getWorldPoint(planck.Vec2(position.x, position.y));
            position.set(worldPos.x, worldPos.y);

            const worldDir = body.getWorldVector(planck.Vec2(direction.x, direction.y));
            direction.set(worldDir.x, worldDir.y);

            const worldNorm = body.getWorldVector(planck.Vec2(segmentNormal.x, segmentNormal.y));
            segmentNormal.set(worldNorm.x, worldNorm.y);
        }

        return { position, direction, normal: segmentNormal, distance };
    }

    public getDirectionShoreline(startX: number, startZ: number, dirX: number, dirZ: number): ShoreInfo | null {
        const body = this.iceberg.physicsBodies[0];
        let localStart = planck.Vec2(startX, startZ);
        let localDir = planck.Vec2(dirX, dirZ);

        if (body) {
            localStart = body.getLocalPoint(localStart);
            localDir = body.getLocalVector(localDir);
        }

        const vertices = (this.polygon as any).vertices as planck.Vec2[];
        let closestT = Infinity;
        let intersectX = 0, intersectZ = 0;


        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const v1 = vertices[j];
            const v2 = vertices[i];

            const dx1 = dirX;
            const dy1 = dirZ;
            const dx2 = v2.x - v1.x;
            const dy2 = v2.y - v1.y;

            const cross = dx1 * dy2 - dy1 * dx2;
            if (Math.abs(cross) < 1e-6) continue;

            const t = ((v1.x - localStart.x) * dy2 - (v1.y - localStart.y) * dx2) / cross;
            const u = ((v1.x - localStart.x) * localDir.y - (v1.y - localStart.y) * localDir.x) / cross;

            if (t > 0 && u >= 0 && u <= 1) {
                if (t < closestT) {
                    closestT = t;
                    intersectX = localStart.x + localDir.x * t;
                    intersectZ = localStart.y + localDir.y * t;
                }
            }
        }

        if (closestT === Infinity) return null;

        // Convert local intersection back to global to query getNearestShoreline which expects global
        let globalIntersectX = intersectX;
        let globalIntersectZ = intersectZ;
        if (body) {
            const worldPos = body.getWorldPoint(planck.Vec2(intersectX, intersectZ));
            globalIntersectX = worldPos.x;
            globalIntersectZ = worldPos.y;
        }

        const shoreInfo = this.getNearestShoreline(globalIntersectX, globalIntersectZ);
        // t is scaled by localDir length vs global dir length. But since both are normalized, it is the same.
        // wait, localDir was transformed by getLocalVector which preserves length! So closestT is correct.
        shoreInfo.distance = closestT;
        return shoreInfo;
    }

    public getNearestWaterFlow(x: number, z: number): THREE.Vector2 {
        const riverSystem = RiverSystem.getInstance();
        const dx = riverSystem.getRiverDerivative(z);
        return new THREE.Vector2(dx, -1).normalize();
    }
}
