import * as THREE from 'three';
import { PlacementManifest, SpatialGrid } from '../../managers/SpatialGrid';
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

// 2. The Declarative Rule
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
        spatialGrid: SpatialGrid,
        terrainProvider: (x: number, z: number) => { height: number, slope: number, distToRiver: number },
        biomeProgressProvider: (z: number) => number,
        seed: number = 0
    ): PlacementManifest[] {
        const manifests: PlacementManifest[] = [];

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
