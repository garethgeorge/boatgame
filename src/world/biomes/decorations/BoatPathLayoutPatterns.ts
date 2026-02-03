import * as THREE from 'three';
import { RiverGeometry } from "../../RiverGeometry";
import { PatternConfig, PatternContext } from "./BoatPathLayoutStrategy";
import { EntityGeneratorContext, EntityGeneratorFn, Habitat, PathPoint } from "./EntityLayoutRules";

export type PlacementType =
    'on-shore' |        // on the river banks within 15m
    'path' |            // water, close to the boat path +/- 2m
    'slalom' |          // water, between 5m from boat and 2m from bank on one side of the path
    'near-shore' |      // between bank and 1/2 way to center on one side
    'middle';           // water, between center and 1/2 way to bank on one side

export interface CommonPatternOptions {
    /** Target area (near path, across river, or on shore) */
    place: PlacementType;
    /** Generates a candidate entity */
    entity: EntityGeneratorFn;
    /** Min and Max density in instances per 100m. Scales from start to end of biome. */
    density?: [number, number];
    /** Minimum required instances */
    minCount?: number;
    /** Maximum allowed instances */
    maxCount?: number;
}

export class Patterns {
    public static scatter(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._scatter(context, opts);
    }

    public static sequence(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._sequence(context, opts);
    }

    public static staggered(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._staggered(context, opts);
    }

    public static gate(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._gate(context, opts);
    }

    public static cluster(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._cluster(context, opts);
    }

    private static _scatter(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            this._tryPlace(context, opts, pathIndex);
        }
    }

    private static _sequence(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            this._tryPlace(context, opts, pathIndex);
        }
    }

    private static _staggered(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            this._tryPlace(context, opts, pathIndex, j % 2 === 0 ? 'left' : 'right');
        }
    }

    private static _gate(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const subCount = Math.ceil(count / 2);
            const step = Math.floor(j / 2);
            const pathIndex = context.range[0] + (step + 0.5) * (context.range[1] - context.range[0]) / subCount;
            this._tryPlace(context, opts, pathIndex, j % 2 === 0 ? 'left' : 'right');
        }
    }

    private static _cluster(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const center = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            const jitter = (Math.random() - 0.5) * 5.0;
            const pathIndex = Math.max(context.range[0], Math.min(context.range[1], center + jitter));
            this._tryPlace(context, opts, pathIndex);
        }
    }

    private static getCount(context: PatternContext, opts: CommonPatternOptions): number {
        const density = this._getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        return count;
    }

    private static _getDensity(density: [number, number] | undefined, progress: number): number {
        if (density === undefined) return 1.0;
        return density[0] + progress * (density[1] - density[0]);
    }

    private static _tryPlace(
        context: PatternContext,
        opts: CommonPatternOptions,
        pathIndex: number,
        side?: 'left' | 'right'
    ): boolean {
        const sample = RiverGeometry.getPathPoint(context.path, pathIndex);
        const range = this._placementRange(context, opts.place, sample, side);

        const ctx: EntityGeneratorContext = {
            sample,
            offset: 0,
            habitat: 'land',
            progress: context.progress,
            biomeZRange: context.biomeZRange
        };

        const attempts = 10;
        for (let i = 0; i < attempts; i++) {
            const offset = range[0] + Math.random() * (range[1] - range[0]);
            const habitat: Habitat = Math.abs(offset) > sample.bankDist ? 'land' : 'water';

            ctx.offset = offset;
            ctx.habitat = habitat;

            const options = opts.entity(ctx);
            if (!options) continue;

            const x = sample.centerPos.x + sample.normal.x * offset;
            const z = sample.centerPos.z + sample.normal.z * offset;

            if (!context.spatialGrid.checkCollision(x, z, options.radius, 0)) {
                context.placements.push({
                    index: pathIndex,
                    offset,
                    entity: options
                });
                context.spatialGrid.insert({
                    position: new THREE.Vector3(x, 0, z),
                    groundRadius: options.radius,
                    canopyRadius: 0
                });
                return true;
            }
        }
        return false;
    }

    private static _placementRange(
        context: PatternContext,
        place: PlacementType,
        pathPoint: PathPoint,
        side?: 'left' | 'right'
    ): [number, number] {
        if (side === undefined) {
            if (place === 'path') {
                side = 0.5 < Math.random() ? 'left' : 'right';
            } else {
                const boatSide = pathPoint.boatXOffset > 0 ? 'right' : 'left';
                side = boatSide === 'right' ? 'left' : 'right';
            }
        }

        if (place === 'on-shore') {
            return side === 'right' ?
                [pathPoint.bankDist, pathPoint.bankDist + 15] :
                [-pathPoint.bankDist - 15, -pathPoint.bankDist];
        } else if (place === 'slalom') {
            return side === 'right' ?
                [pathPoint.boatXOffset + 5.0, pathPoint.bankDist - 2.0] :
                [-pathPoint.bankDist + 2.0, pathPoint.boatXOffset - 5.0];
        } else if (place === 'near-shore') {
            return side === 'right' ?
                [0.5 * pathPoint.bankDist, pathPoint.bankDist + 15] :
                [-pathPoint.bankDist - 15, 0.5 * -pathPoint.bankDist];
        } else if (place === 'middle') {
            return side === 'right' ?
                [0, 0.5 * pathPoint.bankDist] :
                [0.5 * -pathPoint.bankDist, 0];
        } else {
            // path, random position offset by +/-2
            return [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2];
        }
    }
}
