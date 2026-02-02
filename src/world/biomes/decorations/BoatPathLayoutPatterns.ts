import { EntityIds } from "../../../entities/EntityIds";
import { RiverGeometry } from "../../RiverGeometry";
import { BoatPathLayoutConfig, ObstaclePlacement, PathPoint, PatternConfig, PatternContext, SpawnOptionsFn } from "./BoatPathLayoutStrategy";

export type PlacementType =
    'on-shore' |        // on the river banks within 15m
    'path' |            // close to the boat path +/- 2m
    'slalom' |          // between 5m from boat and 2m from bank on one side of the path
    'near-shore' |      // between bank and 1/2 way to center on one side
    'middle';           // between center and 1/2 way to bank on one side

export interface CommonPatternOptions {
    /** Target area (near path, across river, or on shore) */
    place: PlacementType;
    /** Min and Max density in instances per 100m. Scales from start to end of biome. */
    density?: [number, number];
    /** Candidate obstacle types for this pattern */
    types: EntityIds[];
    /** Minimum required instances */
    minCount?: number;
    /** Maximum allowed instances */
    maxCount?: number;
    /** Function called at spawn time to get placement parameters */
    options?: SpawnOptionsFn;
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
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
            ));
        }
    }

    private static _sequence(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
            ));
        }
    }

    private static _staggered(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
                j % 2 === 0 ? 'left' : 'right',
            ));
        }
    }

    private static _gate(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const subCount = Math.ceil(count / 2);
            const step = Math.floor(j / 2);
            const pathIndex = context.range[0] + (step + 0.5) * (context.range[1] - context.range[0]) / subCount;
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
                j % 2 === 0 ? 'left' : 'right',
            ));
        }
    }

    private static _cluster(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const center = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            const jitter = (Math.random() - 0.5) * 5.0;
            const pathIndex = Math.max(context.range[0], Math.min(context.range[1], center + jitter));

            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex
            ));
        }
    }

    public static applyIndividualPlacement(
        context: PatternContext,
        place: PlacementType,
        type: EntityIds,
        spawnOptions: SpawnOptionsFn | undefined,
        pathIndex: number,
        side?: 'left' | 'right'
    ): ObstaclePlacement {
        const pathPoint = RiverGeometry.getPathPoint(context.path, pathIndex);
        if (side === undefined) {
            if (place === 'path') {
                side = 0.5 < Math.random() ? 'left' : 'right';
            } else {
                const boatSide = pathPoint.boatXOffset > 0 ? 'right' : 'left';
                side = boatSide === 'right' ? 'left' : 'right';
            }
        }

        const range = this.placementRange(pathPoint, type, side, place, context.config);
        const aggressiveness = Math.min(1.0, context.progress * 0.7 + Math.random() * 0.3);

        return {
            type,
            index: pathIndex,
            range,
            aggressiveness,
            options: spawnOptions
        };
    }

    public static placementRange(
        pathPoint: PathPoint,
        type: EntityIds,
        side: 'left' | 'right',
        place: PlacementType,
        config: BoatPathLayoutConfig
    ): [number, number] {
        if (place === 'on-shore') {
            return side === 'right' ?
                [pathPoint.bankDist, pathPoint.bankDist + 15] :
                [-pathPoint.bankDist - 15, -pathPoint.bankDist];
        } else if (place === 'slalom') {
            return side === 'right' ?
                [pathPoint.boatXOffset + 5.0, pathPoint.bankDist - 2.0] :
                [-pathPoint.bankDist + 2.0, pathPoint.boatXOffset - 5.0];
        } else if (place === 'near-shore') {
            const isWaterAnimal = config.waterAnimals.includes(type);
            if (isWaterAnimal) {
                return side === 'right' ?
                    [0.5 * pathPoint.bankDist, pathPoint.bankDist] :
                    [-pathPoint.bankDist, 0.5 * -pathPoint.bankDist];
            } else {
                return side === 'right' ?
                    [0.5 * pathPoint.bankDist, pathPoint.bankDist + 15] :
                    [-pathPoint.bankDist - 15, 0.5 * -pathPoint.bankDist];
            }
        } else if (place === 'middle') {
            return side === 'right' ?
                [0, 0.5 * pathPoint.bankDist] :
                [0.5 * -pathPoint.bankDist, 0];
        } else {
            // path, random position offset by +/-2
            return [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2];
        }
    }

    public static getDensity(density: [number, number] | undefined, progress: number): number {
        if (density === undefined) return 1.0;
        return density[0] + progress * (density[1] - density[0]);
    }
}
