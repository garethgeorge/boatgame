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
    speciesId: string;
    position: THREE.Vector3;
    groundRadius: number; // Stored for collision checks (includes spacing adjustments)
    canopyRadius: number;
    speciesRadius: number;
    fitness: number; // Stored to optimize local growth
    options?: any; // type specific - should include scale if needed
}

// 3. The Declarative Rule
export interface DecorationRule {
    // Placement: Returns 0 to 1 (0 = Impossible, 1 = Perfect)
    fitness: (ctx: WorldContext) => number;

    // Attributes: Generates the specific look
    generate: (ctx: WorldContext) => {
        speciesId: string;
        groundRadius: number; // The physical radius of this specific instance
        canopyRadius?: number; // Optional canopy radius
        speciesRadius?: number; // Optional species-specific spacing
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
                    spatialGrid.insert(candidate);
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
                // We use groundRadius for the organic growth step
                const dynamicR = parent.groundRadius;

                let found = false;

                for (let i = 0; i < dynamicK; i++) {
                    const angle = Math.random() * Math.PI * 2;

                    // Generate up to three candidate distances
                    const distances: number[] = [];
                    // 1. Ground distance: Annulus [2r, 4r]
                    distances.push(2 * parent.groundRadius + Math.random() * 2 * parent.groundRadius);

                    // 2. Canopy distance (if exists)
                    if (parent.canopyRadius > 0) {
                        distances.push(2 * parent.canopyRadius + Math.random() * 2 * parent.canopyRadius);
                    }

                    // 3. Species distance (if exists)
                    if (parent.speciesRadius > 0) {
                        distances.push(2 * parent.speciesRadius + Math.random() * 2 * parent.speciesRadius);
                    }

                    for (const dist of distances) {
                        const cx = parent.position.x + Math.cos(angle) * dist;
                        const cz = parent.position.z + Math.sin(angle) * dist;

                        if (cx < region.xMin || cx > region.xMax || cz < region.zMin || cz > region.zMax) continue;

                        const candidate = this.tryPlace(cx, cz, rule, spatialGrid, terrainProvider, biomeProgressProvider);
                        if (candidate) {
                            manifests.push(candidate);
                            activeList.push(candidate);
                            spatialGrid.insert(candidate);
                            found = true;
                            break;
                        }
                    }

                    if (found) break;
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
     * Variable radius is used to thin trees based on local fitness by adjusting
     * species spacing
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
        const speciesId = params.speciesId;
        const groundRadius = params.groundRadius;
        const canopyRadius = params.canopyRadius ?? 0;
        const speciesRadius = params.speciesRadius ? this.getVariableRadius(f, params.speciesRadius) : 0;

        // 5. Proximity Check
        if (spatialGrid.checkCollision(x, z, groundRadius, canopyRadius, speciesRadius, speciesId)) {
            return null;
        }

        return {
            position: new THREE.Vector3(x, terrain.height, z),
            speciesId,
            options: params.options,
            groundRadius,
            canopyRadius,
            speciesRadius,
            fitness: f
        };
    }
}

class SpatialGrid {
    private cellSize: number;
    private maxSearchRadius: number = 0;
    private grid: Map<string, PlacementManifest[]> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    private getKey(x: number, y: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(item: PlacementManifest) {
        const radius = Math.max(item.groundRadius, item.canopyRadius, item.speciesRadius);
        this.maxSearchRadius = Math.max(this.maxSearchRadius, radius);
        const key = this.getKey(item.position.x, item.position.z);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(item);
    }

    checkCollision(x: number, y: number, groundRadius: number, canopyRadius: number, speciesRadius: number, speciesId: string): boolean {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        // Calculate search range based on largest radius involved
        const radius = Math.max(groundRadius, canopyRadius, speciesRadius);
        const searchRange = radius + this.maxSearchRadius;
        const cellRange = Math.ceil(searchRange / this.cellSize);

        for (let i = -cellRange; i <= cellRange; i++) {
            for (let j = -cellRange; j <= cellRange; j++) {
                const key = `${cx + i},${cy + j}`;
                const cellItems = this.grid.get(key);
                if (cellItems) {
                    for (const item of cellItems) {
                        const dx = x - item.position.x;
                        const dy = y - item.position.z;
                        const distSq = dx * dx + dy * dy;

                        // Rule 1: Ground Overlap
                        const groundDist = groundRadius + item.groundRadius;
                        if (distSq < groundDist * groundDist) {
                            return true;
                        }

                        // Rule 2: Canopy Overlap
                        if (canopyRadius > 0 && item.canopyRadius > 0) {
                            const canopyDist = canopyRadius + item.canopyRadius;
                            if (distSq < canopyDist * canopyDist) {
                                return true;
                            }
                        }

                        // Rule 3: Species Spacing
                        if (speciesId === item.speciesId && speciesRadius > 0 && item.speciesRadius > 0) {
                            const specDist = speciesRadius + item.speciesRadius;
                            if (distSq < specDist * specDist) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }
}
