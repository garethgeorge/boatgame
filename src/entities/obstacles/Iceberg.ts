import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../Entity';
import { PhysicsEngine, CollisionCategories } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { ConvexHull } from '../../core/ConvexHull';
import { Polygon } from '../../core/Polygon';
import { DynamicTerrainFeature } from '../DynamicTerrainFeature';

export class Iceberg extends Entity implements DynamicTerrainFeature {
    private animationMixer?: THREE.AnimationMixer;
    private polygon: Polygon;
    private iceHeight: number = 0.55;

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
        this.polygon = new Polygon(vertices);

        // Polygon shape for physics (Convex Hull for safety)
        const hullVertices = ConvexHull.computeVec2(vertices);
        physicsBody.createFixture({
            shape: planck.Polygon(hullVertices),
            density: 10.0, // Heavy ice (5x increase)
            friction: 0.1, // Slippery
            restitution: 0.2,
            filterCategoryBits: CollisionCategories.OBSTACLE
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'iceberg', entity: this, isTerrainFeature: true });

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
        innerMesh.rotation.x = Math.PI / 2;
        innerMesh.position.y = 0.2;

        mesh.add(innerMesh);

        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    wasHitByPlayer() {
        // Solid
    }

    updateLogic(dt: number) {
        if (this.animationMixer) {
            this.animationMixer.update(dt);
        }
    }

    // --- DynamicTerrainFeature Implementation ---

    private getLocalPoint(x: number, z: number): planck.Vec2 {
        const body = this.physicsBodies[0];
        if (body) {
            return body.getLocalPoint(planck.Vec2(x, z));
        }
        return planck.Vec2(x, z);
    }

    containsGlobalPoint(globalX: number, globalZ: number): boolean {
        const point = this.getLocalPoint(globalX, globalZ);
        return this.polygon.containsPoint(point);
    }

    getSurfaceHeight(globalX: number, globalZ: number): number {
        const mesh = this.meshes[0];
        if (mesh) {
            const worldPos = new THREE.Vector3(0, this.iceHeight, 0);
            mesh.localToWorld(worldPos);
            return worldPos.y;
        }
        return this.iceHeight;
    }

    getSurfaceNormal(globalX: number, globalZ: number): THREE.Vector3 {
        const mesh = this.meshes[0];
        let normal = new THREE.Vector3(0, 1, 0);
        if (mesh) {
            normal.applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
        }
        return normal;
    }

    getExactDistanceToEdge(globalX: number, globalZ: number): { distance: number, position: THREE.Vector2, normal: THREE.Vector2 } {
        const point = this.getLocalPoint(globalX, globalZ);
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
                segmentNormal = new THREE.Vector2(dy, -dx).normalize();
            }
        }

        const isInside = this.polygon.containsPoint(point);
        const localDistance = Math.sqrt(minDistanceSq);
        const distance = isInside ? -localDistance : localDistance;
        const position = new THREE.Vector2(closestPoint.x, closestPoint.y);
        const normal = segmentNormal;

        // Transform back to global
        const body = this.physicsBodies[0];
        if (body) {
            const worldPos = body.getWorldPoint(planck.Vec2(position.x, position.y));
            position.set(worldPos.x, worldPos.y);

            const worldNorm = body.getWorldVector(planck.Vec2(normal.x, normal.y));
            normal.set(worldNorm.x, worldNorm.y);
        }

        return { distance, position, normal };
    }

    rayCastExactEdge(startX: number, startZ: number, dirX: number, dirZ: number): { t: number, intersectX: number, intersectZ: number, normal: THREE.Vector2 } | null {
        let localStart = planck.Vec2(startX, startZ);
        let localDir = planck.Vec2(dirX, dirZ);
        const body = this.physicsBodies[0];

        if (body) {
            localStart = body.getLocalPoint(localStart);
            localDir = body.getLocalVector(localDir);
        }

        const vertices = (this.polygon as any).vertices as planck.Vec2[];
        let closestT = Infinity;
        let intersectX = 0, intersectZ = 0;
        let intersectNormal = new THREE.Vector2(0, 0);

        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const v1 = vertices[j];
            const v2 = vertices[i];

            const dx1 = localDir.x;
            const dy1 = localDir.y;
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
                    intersectNormal = new THREE.Vector2(dy2, -dx2).normalize();
                }
            }
        }

        if (closestT === Infinity) return null;

        let globalIntersectX = intersectX;
        let globalIntersectZ = intersectZ;
        if (body) {
            const worldPos = body.getWorldPoint(planck.Vec2(intersectX, intersectZ));
            globalIntersectX = worldPos.x;
            globalIntersectZ = worldPos.y;

            const worldNorm = body.getWorldVector(planck.Vec2(intersectNormal.x, intersectNormal.y));
            intersectNormal.set(worldNorm.x, worldNorm.y);
        }

        return {
            t: closestT,
            intersectX: globalIntersectX,
            intersectZ: globalIntersectZ,
            normal: intersectNormal
        };
    }
}
