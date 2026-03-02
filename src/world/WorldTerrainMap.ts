import * as THREE from 'three';
import * as planck from 'planck';
import { TerrainMap, Zone, SurfaceInfo, ShoreInfo, EdgeType } from './TerrainMap';
import { RiverSystem } from './RiverSystem';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { DynamicTerrainFeature } from '../entities/DynamicTerrainFeature';

export class WorldTerrainMap implements TerrainMap {
    private static instance: WorldTerrainMap;
    private physicsEngine: PhysicsEngine | null = null;

    private constructor() { }

    public static getInstance(): WorldTerrainMap {
        if (!WorldTerrainMap.instance) {
            WorldTerrainMap.instance = new WorldTerrainMap();
        }
        return WorldTerrainMap.instance;
    }

    public init(physicsEngine: PhysicsEngine) {
        this.physicsEngine = physicsEngine;
    }

    private getDynamicFeaturesAt(x: number, z: number, radius: number): DynamicTerrainFeature[] {
        if (!this.physicsEngine) return [];
        const features: DynamicTerrainFeature[] = [];

        // Box2D uses half-widths
        const aabb = {
            lowerBound: planck.Vec2(x - radius, z - radius),
            upperBound: planck.Vec2(x + radius, z + radius)
        };

        this.physicsEngine.world.queryAABB(aabb, (fixture) => {
            const body = fixture.getBody();
            const userData = body.getUserData() as any;
            if (userData && userData.isTerrainFeature && userData.entity) {
                const entity = userData.entity as unknown as DynamicTerrainFeature;
                if (!features.includes(entity)) {
                    features.push(entity);
                }
            }
            return true;
        });

        return features;
    }

    public getSurfaceInfo(x: number, z: number): SurfaceInfo {
        // Dynamic features (Icebergs) take precedence
        const features = this.getDynamicFeaturesAt(x, z, 0.1);
        for (const feature of features) {
            if (feature.containsGlobalPoint(x, z)) {
                return {
                    y: feature.getSurfaceHeight(x, z),
                    normal: feature.getSurfaceNormal(x, z),
                    zone: 'land'
                };
            }
        }

        const riverSystem = RiverSystem.getInstance();
        const banks = riverSystem.getBankPositions(z);

        if (banks.left < x && x < banks.right) {
            return { y: 0, normal: new THREE.Vector3(0, 1, 0), zone: 'water' };
        }

        const terrainHeight = riverSystem.terrainGeometry.calculateHeight(x, z);
        const terrainNormal = riverSystem.terrainGeometry.calculateNormal(x, z);

        return { y: terrainHeight, normal: terrainNormal, zone: 'land' };
    }

    public getZone(
        x: number, z: number, radius: number
    ): { zone: Zone, t: number } {
        let bestT = Infinity;
        let bestZone: Zone | null = null;

        // 1. Evaluate explicit dynamic terrain features
        const features = this.getDynamicFeaturesAt(x, z, radius + 2.0); // Buffer for safety
        for (const feature of features) {
            const { distance } = feature.getExactDistanceToEdge(x, z);
            // distance is negative inside the feature
            const featureSignedWaterDistance = distance;

            let featureT = 0;
            if (radius > 0) {
                featureT = Math.max(-1, Math.min(1, featureSignedWaterDistance / radius));
            } else {
                featureT = featureSignedWaterDistance > 0 ? 1 : featureSignedWaterDistance < 0 ? -1 : 0;
            }

            let featureZone: Zone = 'margin';
            if (featureSignedWaterDistance >= radius) {
                featureZone = 'water';
            } else if (featureSignedWaterDistance <= -radius) {
                featureZone = 'land';
            }

            if (featureT < bestT) {
                bestT = featureT;
                bestZone = featureZone;
            }
        }

        // 2. Evaluate River System
        const riverSystem = RiverSystem.getInstance();
        const banks = riverSystem.getBankPositions(z);
        const distFromLeft = x - banks.left;
        const distFromRight = banks.right - x;
        const riverSignedWaterDistance = Math.min(distFromLeft, distFromRight);

        let riverT = 0;
        if (radius > 0) {
            riverT = Math.max(-1, Math.min(1, riverSignedWaterDistance / radius));
        } else {
            riverT = riverSignedWaterDistance > 0 ? 1 : riverSignedWaterDistance < 0 ? -1 : 0;
        }

        let riverZone: Zone = 'margin';
        if (riverSignedWaterDistance >= radius) {
            riverZone = 'water';
        } else if (riverSignedWaterDistance <= -radius) {
            riverZone = 'land';
        }

        if (riverT < bestT) {
            bestT = riverT;
            bestZone = riverZone;
        }

        return { zone: bestZone!, t: bestT };
    }

    public getNearestEdge(x: number, z: number, edgeMask: EdgeType = EdgeType.ANY): ShoreInfo {
        let closestScore = Infinity;
        let result: ShoreInfo | null = null;

        if (edgeMask & EdgeType.SHORE) {
            const riverSystem = RiverSystem.getInstance();
            const banks = riverSystem.getBankPositions(z);
            const derivation = riverSystem.getRiverDerivative(z);

            let position: THREE.Vector2;
            let normal: THREE.Vector2;
            let distance: number;

            if (Math.abs(x - banks.left) < Math.abs(x - banks.right)) {
                position = new THREE.Vector2(banks.left, z);
                distance = Math.abs(x - banks.left);
                normal = new THREE.Vector2(1, -derivation).normalize();
            } else {
                position = new THREE.Vector2(banks.right, z);
                distance = Math.abs(x - banks.right);
                normal = new THREE.Vector2(-1, derivation).normalize();
            }

            if (distance < closestScore) {
                closestScore = distance;
                const direction = new THREE.Vector2(normal.y, -normal.x);
                result = { position, direction, normal, distance };
            }
        }

        if (edgeMask & EdgeType.DYNAMIC_FEATURE) {
            const features = this.getDynamicFeaturesAt(x, z, 50); // Seek wide
            for (const feature of features) {
                const { distance, position, normal } = feature.getExactDistanceToEdge(x, z);
                // distance can be negative if inside, we want the absolute distance for nearest check
                const absDist = Math.abs(distance);
                if (absDist < closestScore) {
                    closestScore = absDist;
                    const direction = new THREE.Vector2(normal.y, -normal.x);
                    // Use actual distance (signed) for the result so callers know if inside
                    result = { position, direction, normal, distance: distance };
                }
            }
        }

        // If nothing was found (e.g. searching dynamic only with no objects nearby), fallback to shore manually
        if (!result) return this.getNearestEdge(x, z, EdgeType.SHORE);

        return result;
    }

    public getDirectionEdge(startX: number, startZ: number, dirX: number, dirZ: number, edgeMask: EdgeType = EdgeType.ANY): ShoreInfo | null {
        let closestDist = Infinity;
        let result: ShoreInfo | null = null;

        if (edgeMask & EdgeType.SHORE) {
            const riverSystem = RiverSystem.getInstance();
            const distance = riverSystem.getDistanceToWater(new THREE.Vector2(startX, startZ), { x: dirX, y: dirZ });
            if (distance >= 0 && distance < closestDist) {
                const intersectX = startX + dirX * distance;
                const intersectZ = startZ + dirZ * distance;
                const info = this.getNearestEdge(intersectX, intersectZ, EdgeType.SHORE);
                info.distance = distance;
                closestDist = distance;
                result = info;
            }
        }

        if ((edgeMask & EdgeType.DYNAMIC_FEATURE) && this.physicsEngine) {
            // Give Box2D a max raycast distance, e.g. 100 units
            const MAX_DIST = 100;
            const p1 = planck.Vec2(startX, startZ);
            const p2 = planck.Vec2(startX + dirX * MAX_DIST, startZ + dirZ * MAX_DIST);

            const hitFeatures = new Set<DynamicTerrainFeature>();

            this.physicsEngine.world.rayCast(p1, p2, (fixture, point, normal, fraction) => {
                const userData = fixture.getBody().getUserData() as any;
                if (userData && userData.isTerrainFeature && userData.entity) {
                    // Collect all hits, because convex hull raycast could intersect
                    hitFeatures.add(userData.entity as DynamicTerrainFeature);
                }
                return 1.0; // Continue to capture all intersections
            });

            for (const feature of hitFeatures) {
                const hit = feature.rayCastExactEdge(startX, startZ, dirX, dirZ);
                if (hit && hit.t > 0 && hit.t < closestDist) {
                    closestDist = hit.t;
                    const position = new THREE.Vector2(hit.intersectX, hit.intersectZ);
                    const direction = new THREE.Vector2(hit.normal.y, -hit.normal.x);
                    result = {
                        distance: hit.t,
                        position,
                        direction,
                        normal: hit.normal
                    };
                }
            }
        }

        return result;
    }

    public getNearestWaterFlow(x: number, z: number): THREE.Vector2 {
        const riverSystem = RiverSystem.getInstance();
        const dx = riverSystem.getRiverDerivative(z);
        // Flow is in -Z direction by default, so derivative dz/dz = -1
        return new THREE.Vector2(dx, -1).normalize();
    }

    public getTerrainSlots() {
        return RiverSystem.getInstance().slots;
    }

    public getNearestWaterChannel(x: number, z: number): { minX: number, maxX: number } {
        const banks = RiverSystem.getInstance().getBankPositions(z);
        return { minX: banks.left, maxX: banks.right };
    }
}
