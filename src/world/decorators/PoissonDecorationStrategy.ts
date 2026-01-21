import * as THREE from 'three';
import { PlacementManifest, SpatialGrid } from '../../managers/SpatialGrid';
import { SimplexNoise } from '../SimplexNoise';

// Environmental Context
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

// The Declarative Rule
export interface DecorationRule {
    // Placement: Returns 0 to 1 (0 = Impossible, 1 = Perfect)
    fitness: (ctx: WorldContext) => number;

    // Attributes: Generates the specific look
    generate: (ctx: WorldContext) => {
        // The physical radius of this specific instance at ground and canopy levels
        groundRadius: number;
        canopyRadius?: number;

        // Extra space between this and other instances, applied when placing the
        // instance, added to canopy if it has one else to the ground radius.
        spacing?: number;

        // Type specific options
        options: any;
    };
}

// Poisson algorithm adds spacing used to spawn instances around a parent
interface PoissonPlacement extends PlacementManifest {
    spacing: number;
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
        const manifests: PoissonPlacement[] = [];

        const sortedRules = rules;

        const width = region.xMax - region.xMin;
        const depth = region.zMax - region.zMin;

        // Bridson's algorithm constants (approximate for multi-class)
        const maxK = 30; // Max attempts per active sample (simplified here to attempts per unit area)

        for (const rule of sortedRules) {
            const activeList: PoissonPlacement[] = [];

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

                // Dynamic k Implementation, not currently used so hard coded to 1
                const parentFitness = 1.0;

                // Scale k: High fitness = 30 tries, Low fitness = fewer tries (Natural Thinning)
                const dynamicK = Math.max(1, Math.floor(maxK * parentFitness));

                let found = false;

                // Try random locations around the chosen parent, we assume child
                // spacing is between 0.5 and 1.5 of the parent
                const rmin = parent.spacing * 1.5;
                const drmax = parent.spacing * 1.0;
                for (let i = 0; i < dynamicK; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = rmin + drmax * Math.random();

                    const cx = parent.position.x + Math.cos(angle) * distance;
                    const cz = parent.position.z + Math.sin(angle) * distance;

                    if (cx < region.xMin || cx > region.xMax || cz < region.zMin || cz > region.zMax) continue;

                    const candidate = this.tryPlace(cx, cz, rule, spatialGrid, terrainProvider, biomeProgressProvider);
                    if (candidate) {
                        manifests.push(candidate);
                        activeList.push(candidate);
                        spatialGrid.insert(candidate);
                        found = true;
                        break;
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

    private tryPlace(
        x: number,
        z: number,
        rule: DecorationRule,
        spatialGrid: SpatialGrid,
        terrainProvider: (x: number, z: number) => { height: number, slope: number, distToRiver: number },
        biomeProgressProvider: (z: number) => number
    ): PoissonPlacement | null {

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

        // 5. Proximity Check
        const groundRadius = params.groundRadius;
        const canopyRadius = params.canopyRadius ?? 0;
        let spacing;
        if (params.canopyRadius <= 0.0) {
            spacing = groundRadius + (params.spacing ?? 0);
            if (spatialGrid.checkGroundCollision(x, z, spacing))
                return null;
        } else {
            spacing = canopyRadius + (params.spacing ?? 0);
            if (spatialGrid.checkCollision(x, z, groundRadius, spacing)) {
                return null;
            }
        }

        return {
            position: new THREE.Vector3(x, terrain.height, z),
            options: params.options,
            groundRadius,
            canopyRadius,
            spacing,
        };
    }
}
