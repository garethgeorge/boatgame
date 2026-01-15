import * as THREE from 'three';
import { SimplexNoise } from '../SimplexNoise';

// 1. Environmental Context
export interface WorldContext {
    pos: { x: number, y: number }; // World X, Z (using y for z in 2D context)
    elevation: number;
    slope: number;
    distanceToRiver: number;
    biomeProgress: number; // 0.0 (Start) to 1.0 (End of river)
    // Helper to access random values cleanly
    random: () => number;
}

// 2. The Decoration Result (The Manifest Output)
export interface PlacementManifest {
    type: string;
    position: THREE.Vector3;
    scale: number;
    rotation: number;
    options?: any; // type specific
    radius: number; // Stored for collision checks
    fitness?: number; // Stored to optimize local growth
}

// 3. The Declarative Rule
export interface DecorationRule {
    id: string;
    baseRadius: number; // Radius at scale 1.0

    // Placement: Returns 0 to 1 (0 = Impossible, 1 = Perfect)
    fitness: (ctx: WorldContext) => number;

    // Clustering: Boosts fitness based on noise (0 to 1)
    // Higher value = more localized "patches"
    clusterFactor: number;

    // Attributes: Generates the specific look
    generate: (ctx: WorldContext) => {
        scale: number;
        rotation?: number;
        options?: any;
    };
}

export class PoissonDecorationStrategy {
    private simplex = new SimplexNoise();

    constructor() { }

    public generate(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        terrainProvider: (x: number, z: number) => { height: number, slope: number, distToRiver: number },
        biomeProgressProvider: (z: number) => number,
        seed: number = 0
    ): PlacementManifest[] {
        const manifests: PlacementManifest[] = [];
        const spatialGrid = new SpatialGrid(Math.max(...rules.map(r => r.baseRadius)) * 2);

        // Sort rules by base radius (Descending) - Hierarchical Priority Queue
        // We want to place large objects first.
        const sortedRules = [...rules].sort((a, b) => b.baseRadius - a.baseRadius);

        const width = region.xMax - region.xMin;
        const depth = region.zMax - region.zMin;
        const area = width * depth;

        // Bridson's algorithm constants (approximate for multi-class)
        const maxK = 30; // Max attempts per active sample (simplified here to attempts per unit area)

        this.simplex = new SimplexNoise(seed);

        for (const rule of sortedRules) {
            const activeList: PlacementManifest[] = [];
            const radius = rule.baseRadius;

            // Phase 1: Seeding
            // We attempt to plant initial seeds to handle disconnected valid areas.
            // Heuristic: scale number of seeds with area, but clamp it.
            const seedAttempts = 50;

            for (let i = 0; i < seedAttempts; i++) {
                // Pick random point
                const x = region.xMin + Math.random() * width;
                const z = region.zMin + Math.random() * depth;

                const candidate = this.tryPlace(x, z, rule, spatialGrid, terrainProvider, biomeProgressProvider);
                if (candidate) {
                    manifests.push(candidate);
                    activeList.push(candidate);
                    spatialGrid.insert(candidate.position.x, candidate.position.z, candidate.radius, candidate);
                }
            }

            // Phase 2: Growth (Bridson's)
            while (activeList.length > 0) {
                const index = Math.floor(Math.random() * activeList.length);
                const parent = activeList[index];

                // Dynamic k Implementation
                // Use stored fitness from parent to determine how hard we try to grow
                const parentFitness = parent.fitness || 0;

                // Scale k: High fitness = 30 tries, Low fitness = fewer tries (Natural Thinning)
                const dynamicK = maxK; Math.max(1, Math.floor(maxK * parentFitness));

                let found = false;

                for (let i = 0; i < dynamicK; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    // Annulus: r to 2r
                    const dist = radius + Math.random() * radius;

                    const cx = parent.position.x + Math.cos(angle) * dist;
                    const cz = parent.position.z + Math.sin(angle) * dist;

                    if (cx < region.xMin || cx > region.xMax || cz < region.zMin || cz > region.zMax) continue;

                    const candidate = this.tryPlace(cx, cz, rule, spatialGrid, terrainProvider, biomeProgressProvider);
                    if (candidate) {
                        manifests.push(candidate);
                        activeList.push(candidate);
                        spatialGrid.insert(
                            candidate.position.x, candidate.position.z,
                            candidate.radius, candidate
                        );
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    // No offspring produced after k attempts, remove from active list
                    activeList.splice(index, 1);
                }
            }
        }

        return manifests;
    }

    private tryPlace(
        x: number,
        z: number,
        rule: DecorationRule,
        spatialGrid: SpatialGrid,
        terrainProvider: (x: number, z: number) => { height: number, slope: number, distToRiver: number },
        biomeProgressProvider: (z: number) => number
    ): PlacementManifest | null {

        const terrain = terrainProvider(x, z);
        const biomeProgress = biomeProgressProvider(z);

        const ctx: WorldContext = {
            pos: { x, y: z },
            elevation: terrain.height,
            slope: terrain.slope,
            distanceToRiver: terrain.distToRiver,
            biomeProgress,
            random: Math.random
        };

        let f = rule.fitness(ctx);

        if (rule.clusterFactor > 0) {
            const noiseScale = 0.05;
            const noiseVal = (this.simplex.noise2D(x * noiseScale, z * noiseScale) + 1) * 0.5;
            f *= (1 - rule.clusterFactor) + (rule.clusterFactor * noiseVal * 2.0);
        }

        if (f > 1) f = 1;
        if (f <= 0) return null;
        if (Math.random() > f) return null;

        // 4. Parameter Baking
        const params = rule.generate(ctx);
        const scale = params.scale;
        const instanceRadius = rule.baseRadius * scale;

        // 5. Proximity Check
        if (spatialGrid.checkCollision(x, z, instanceRadius)) {
            return null;
        }

        return {
            type: rule.id,
            position: new THREE.Vector3(x, terrain.height, z),
            scale: scale,
            rotation: params.rotation || 0,
            options: params.options,
            radius: instanceRadius,
            fitness: f
        };
    }
}

class SpatialGrid {
    private cellSize: number;
    private grid: Map<string, PlacementManifest[]> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    private getKey(x: number, y: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(x: number, y: number, radius: number, item: PlacementManifest) {
        const key = this.getKey(x, y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(item);
    }

    checkCollision(x: number, y: number, radius: number): boolean {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        // Check 3x3 neighbors
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${cx + i},${cy + j}`;
                const cellItems = this.grid.get(key);
                if (cellItems) {
                    for (const item of cellItems) {
                        const dx = x - item.position.x;
                        const dy = y - item.position.z; // item.position is Vector3 (x, y=height, z)
                        const distSq = dx * dx + dy * dy;
                        const minDist = radius + item.radius;
                        if (distSq < minDist * minDist) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
