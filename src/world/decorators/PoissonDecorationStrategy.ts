import * as THREE from 'three';
import { SimplexNoise } from '../SimplexNoise';

// 1. Environmental Context
export interface WorldContext {
    pos: { x: number, y: number }; // World X, Z (using y for z in 2D context)
    elevation: number;
    slope: number;
    distanceToRiver: number;
    biomeProgress: number; // 0.0 (Start) to 1.0 (End of river)
    // Helpers to access random values cleanly
    random: () => number;
    noise2D: (x: number, y: number) => number;
}

// 2. The Decoration Result (The Manifest Output)
export interface PlacementManifest {
    position: THREE.Vector3;
    options?: any; // type specific - should include scale if needed
    radius: number; // Stored for collision checks (includes spacing adjustments)
    fitness: number; // Stored to optimize local growth
}

// 3. The Declarative Rule
export interface DecorationRule {
    // Placement: Returns 0 to 1 (0 = Impossible, 1 = Perfect)
    fitness: (ctx: WorldContext) => number;

    // Attributes: Generates the specific look
    generate: (ctx: WorldContext) => {
        radius: number; // The physical radius of this specific instance
        options: any;
    };
}

export class PoissonDecorationStrategy {
    private noise2D: SimplexNoise;

    constructor(noise2D: SimplexNoise) {
        this.noise2D = noise2D;
    }

    public generate(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        gridSize: number,
        terrainProvider: (x: number, z: number) => { height: number, slope: number, distToRiver: number },
        biomeProgressProvider: (z: number) => number,
        seed: number = 0
    ): PlacementManifest[] {
        const manifests: PlacementManifest[] = [];
        const spatialGrid = new SpatialGrid(gridSize);

        const sortedRules = rules;

        const width = region.xMax - region.xMin;
        const depth = region.zMax - region.zMin;

        // Bridson's algorithm constants (approximate for multi-class)
        const maxK = 30; // Max attempts per active sample (simplified here to attempts per unit area)

        for (const rule of sortedRules) {
            const activeList: PlacementManifest[] = [];

            // Phase 1: Seeding
            // We attempt to plant initial seeds to handle disconnected valid areas.
            // Heuristic: scale number of seeds with area, but clamp it.
            const seedAttempts = 100; // Increased from 50

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
                const dynamicK = Math.max(1, Math.floor(maxK * parentFitness));

                // dynamicR is the spacing radius (includes fitness-based thinning)
                const dynamicR = parent.radius;

                let found = false;

                for (let i = 0; i < dynamicK; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    // Annulus: [r_min, 2 * r_min] where r_min = 2 * dynamicR
                    const dist = 2 * dynamicR + Math.random() * 2 * dynamicR;

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

    /**
     * Variable radius is used to thin trees based on local fitness
     */
    private getVariableRadius(fitness: number, minRadius: number): number {
        // using hard coded max of 4
        const maxRadius = minRadius * 4.0;

        // We invert the fitness: 
        // If fitness is 1, radius is minRadius. 
        // If fitness is 0, radius is effectively infinite (or maxRadius).
        if (fitness <= 0) return Infinity;

        // Using a power curve here helps the "thinning" look more natural
        const t = 1 - Math.pow(fitness, 2);
        return minRadius + (maxRadius - minRadius) * t;
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
            random: Math.random,
            noise2D: (x, y) => (this.noise2D.noise2D(x, y))
        };

        let f = rule.fitness(ctx);
        if (f > 1) f = 1;
        if (f <= 0) return null;
        if (Math.random() > f) return null;

        // 4. Parameter Baking
        const params = rule.generate(ctx);
        const spacingRadius = this.getVariableRadius(f, params.radius);

        // 5. Proximity Check
        if (spatialGrid.checkCollision(x, z, spacingRadius)) {
            return null;
        }

        return {
            position: new THREE.Vector3(x, terrain.height, z),
            options: params.options,
            radius: spacingRadius, // Store spacing radius for collision checks
            fitness: f
        };
    }
}

class SpatialGrid {
    private cellSize: number;
    private maxRadius: number = 0;
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
        this.maxRadius = Math.max(this.maxRadius, radius);
        const key = this.getKey(x, y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(item);
    }

    checkCollision(x: number, y: number, radius: number): boolean {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        // Calculate search range based on radius + maxRadius in grid
        const searchRange = radius + this.maxRadius;
        const cellRange = Math.ceil(searchRange / this.cellSize);

        for (let i = -cellRange; i <= cellRange; i++) {
            for (let j = -cellRange; j <= cellRange; j++) {
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
