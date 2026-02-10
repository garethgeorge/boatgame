import * as THREE from 'three';
import { AnySpatialGrid } from '../../core/SpatialGrid';
import { SimplexNoise } from '../../core/SimplexNoise';
import { CoreMath } from '../../core/CoreMath';
import { DecorationPlacement, DecorationRequirements } from './DecorationPlacement';
import { DecorationRule, DecorationParams } from './DecorationRule';
import { WorldParams } from './WorldParams';

export interface WorldMap {
    sample(x: number, y: number): number;
}

export class PoissonDecorationStrategy {

    constructor(noise2D: SimplexNoise) {
    }

    public *generateIterator(
        world: WorldParams,
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: AnySpatialGrid,
        requirements: DecorationRequirements = undefined,
    ): Generator<void | Promise<void>, DecorationPlacement[], unknown> {
        const manifests: DecorationPlacement[] = [];

        const width = region.xMax - region.xMin;
        const depth = region.zMax - region.zMin;

        // Reuse context to reduce GC pressure
        const ctx: DecorationParams = {
            x: 0, z: 0,
            elevation: 0,
            slope: 0,
            distanceToRiver: 0,
            world: world
        };

        for (const rule of rules) {
            const activeList: DecorationPlacement[] = [];

            // Phase 0: Automatic Seeding from Requirements
            if (requirements && requirements.has(rule.id)) {
                for (const placement of requirements.get(rule.id)) {
                    if (placement.x < region.xMin || placement.x > region.xMax ||
                        placement.z < region.zMin || placement.z > region.zMax) continue;

                    manifests.push(placement);
                    activeList.push(placement);
                    spatialGrid.insert(placement);
                }
            }

            // Phase 1: Seeding
            const seedAttempts = 100;
            for (let i = 0; i < seedAttempts; i++) {
                const x = region.xMin + Math.random() * width;
                const z = region.zMin + Math.random() * depth;

                const candidate = this.tryPlace(x, z, rule,
                    spatialGrid, ctx);
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

                    if (cx < region.xMin || cx > region.xMax ||
                        cz < region.zMin || cz > region.zMax) continue;

                    const candidate = this.tryPlace(cx, cz, rule,
                        spatialGrid, ctx);
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
        ctx: DecorationParams,
        isAutomaticSeed: boolean = false
    ): DecorationPlacement | null {
        // Quick point-in-circle check before expensive calculations.
        // If the center point is already inside another's ground radius, it's a collision.
        // We skip this check for automatic seeds as they are required.
        if (!isAutomaticSeed && spatialGrid.checkGroundCollision(x, z, 0)) {
            return null;
        }

        const terrain = ctx.world.terrainProvider(x, z);

        ctx.x = x;
        ctx.z = z;
        ctx.elevation = terrain.height;
        ctx.slope = terrain.slope;
        ctx.distanceToRiver = terrain.distToRiver;

        if (!isAutomaticSeed) {
            let f = rule.fitness(ctx);
            if (f > 1) f = 1;
            if (f <= 0) return null;
            if (Math.random() > f) return null;
        }

        const params = rule.generate(ctx);
        if (!params) return null;
        params.fitness = 1.0;

        if (isAutomaticSeed) return params;

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
