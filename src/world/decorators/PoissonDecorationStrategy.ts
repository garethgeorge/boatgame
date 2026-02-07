import * as THREE from 'three';
import { PlacementManifest, AnySpatialGrid } from '../../core/SpatialGrid';
import { SimplexNoise } from '../../core/SimplexNoise';
import { CoreMath } from '../../core/CoreMath';
import { DecorationInstance } from '../factories/DecorationFactory';

export interface WorldMap {
    sample(x: number, y: number): number;
}

// Environmental Context
export interface WorldContext {
    pos: { x: number, y: number }; // World X, Z (using y for z in 2D context)
    elevation: number;
    slope: number;
    distanceToRiver: number;
    biomeProgress: number; // 0.0 (Start) to 1.0 (End of river)
    // Helpers to access random values cleanly
    random: () => number;
    gaussian: () => number;
    noise2D: (x: number, y: number) => number;
    sampleMap: (name: string, x?: number, y?: number) => number;
}

// The Declarative Rule
export interface DecorationRule {
    // Placement: Returns 0 to 1 (0 = Impossible, 1 = Perfect)
    fitness: (ctx: WorldContext) => number;

    // Attributes: Generates the specific look
    generate: (ctx: WorldContext) => DecorationPlacement;
}

export interface DecorationContext {
    tryPlaceInstances(
        instances: DecorationInstance[],
        kind: string,
        x: number, y: number, z: number,
        scale: number, rotation: number
    );

    tryPlaceObject(
        object: THREE.Object3D,
        kind: string,
        x: number, y: number, z: number,
        scale: number, rotation: number
    );
}

export abstract class DecorationPlacement implements PlacementManifest {
    public readonly totalSpacing: number;

    constructor(
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly groundRadius: number,
        public readonly canopyRadius: number = 0,
        extraSpacing: number = 0,
        public fitness: number = 1.0
    ) {
        const baseRadius = canopyRadius > 0 ? canopyRadius : groundRadius;
        this.totalSpacing = Math.max(0.01, baseRadius + extraSpacing);
    }

    public abstract get kind(): string;

    /**
     * Spawns the decoration into the world.
     */
    public abstract place(ctx: DecorationContext): void;

    /** 
     * Generator that yields promises for assets that must be loaded 
     * before this decoration can be placed.
     */
    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        // Default: nothing to load
    }
}

export class PoissonDecorationStrategy {
    private noise2D: SimplexNoise;

    constructor(noise2D: SimplexNoise) {
        this.noise2D = noise2D;
    }

    public *generateIterator(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: AnySpatialGrid,
        terrainProvider: (x: number, z: number) => { height: number, slope: number, distToRiver: number },
        biomeProgressProvider: (z: number) => number,
        seed: number = 0,
        maps: Record<string, WorldMap> = {}
    ): Generator<void | Promise<void>, DecorationPlacement[], unknown> {
        const manifests: DecorationPlacement[] = [];

        const width = region.xMax - region.xMin;
        const depth = region.zMax - region.zMin;

        // Reuse context to reduce GC pressure
        const ctx: WorldContext = {
            pos: { x: 0, y: 0 },
            elevation: 0,
            slope: 0,
            distanceToRiver: 0,
            biomeProgress: 0,
            random: Math.random,
            gaussian: CoreMath.createGaussianRNG(Math.random),
            noise2D: (x, y) => this.noise2D.noise2D(x, y),
            sampleMap: (name, x, y) => {
                const map = maps[name];
                if (!map) return 0;
                return map.sample(x ?? ctx.pos.x, y ?? ctx.pos.y);
            }
        };

        for (const rule of rules) {
            const activeList: DecorationPlacement[] = [];

            // Phase 1: Seeding
            const seedAttempts = 100;
            for (let i = 0; i < seedAttempts; i++) {
                const x = region.xMin + Math.random() * width;
                const z = region.zMin + Math.random() * depth;

                const candidate = this.tryPlace(x, z, rule, spatialGrid, terrainProvider, biomeProgressProvider, ctx);
                if (candidate) {
                    manifests.push(candidate);
                    activeList.push(candidate);
                    spatialGrid.insert(candidate);
                }
            }
            yield;

            // Phase 2: Growth (Bridson's)
            let attemptsSinceYield = 0;
            while (activeList.length > 0) {
                const index = Math.floor(Math.random() * activeList.length);
                const parent = activeList[index];

                // Calculate k based on how "easy" it was to place the parent
                const dynamicK = Math.round(5 + (15 * parent.fitness));

                let found = false;
                const rmin = parent.totalSpacing * 1.5;
                const drmax = parent.totalSpacing * 1.0;

                for (let i = 0; i < dynamicK; i++) {
                    attemptsSinceYield++;
                    const angle = Math.random() * Math.PI * 2;
                    const distance = rmin + drmax * Math.random();

                    const cx = parent.x + Math.cos(angle) * distance;
                    const cz = parent.z + Math.sin(angle) * distance;

                    if (cx < region.xMin || cx > region.xMax || cz < region.zMin || cz > region.zMax) continue;

                    const candidate = this.tryPlace(cx, cz, rule, spatialGrid, terrainProvider, biomeProgressProvider, ctx);
                    if (candidate) {
                        // fitness is an estimate of how crowded the neighborhood is
                        candidate.fitness *= 1 / (i + 1);
                        manifests.push(candidate);
                        activeList.push(candidate);
                        spatialGrid.insert(candidate);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    // Swap-and-pop for O(1) removal
                    const last = activeList.pop()!;
                    if (index < activeList.length) {
                        activeList[index] = last;
                    }
                }

                if (attemptsSinceYield > 100) { // Increased yield threshold
                    yield;
                    attemptsSinceYield = 0;
                }
            }
        }

        return manifests;
    }

    private tryPlace(
        x: number,
        z: number,
        rule: DecorationRule,
        spatialGrid: AnySpatialGrid,
        terrainProvider: (x: number, z: number) => { height: number, slope: number, distToRiver: number },
        biomeProgressProvider: (z: number) => number,
        ctx: WorldContext
    ): DecorationPlacement | null {
        // Quick point-in-circle check before expensive calculations.
        // If the center point is already inside another's ground radius, it's a collision.
        if (spatialGrid.checkGroundCollision(x, z, 0)) {
            return null;
        }

        const terrain = terrainProvider(x, z);
        const biomeProgress = biomeProgressProvider(z);

        ctx.pos.x = x;
        ctx.pos.y = z;
        ctx.elevation = terrain.height;
        ctx.slope = terrain.slope;
        ctx.distanceToRiver = terrain.distToRiver;
        ctx.biomeProgress = biomeProgress;

        let f = rule.fitness(ctx);
        if (f > 1) f = 1;
        if (f <= 0) return null;
        if (Math.random() > f) return null;

        const params = rule.generate(ctx);
        params.fitness = 1.0;

        const groundRadius = params.groundRadius;
        const canopyRadius = params.canopyRadius ?? 0;
        const totalSpacing = params.totalSpacing;

        if (canopyRadius <= 0.0) {
            if (spatialGrid.checkGroundCollision(x, z, totalSpacing))
                return null;
        } else {
            if (spatialGrid.checkCollision(x, z, groundRadius, totalSpacing)) {
                return null;
            }
        }

        return params;
    }
}
