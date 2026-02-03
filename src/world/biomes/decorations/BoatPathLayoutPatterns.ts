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
    /** Min and Max density in instances per 100m. Scales from start to end of biome. */
    density?: [number, number];
    /** Generates a candidate entity */
    entity: EntityGeneratorFn;
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
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        let ctx: EntityGeneratorContext = {
            sample: undefined,
        };

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            ctx.sample = RiverGeometry.getPathPoint(context.path, pathIndex);

            const range = this.placementRange(context, opts.place, ctx.sample);

            const entity = opts.entity(ctx);
            const aggressiveness = Math.min(1.0, context.progress * 0.7 + Math.random() * 0.3);

            this.clipRange(ctx.sample, range, entity.habitat);

            context.placements.push({
                index: pathIndex,
                range: range,
                aggressiveness,
                entity: entity
            });
        }
    }

    private static _sequence(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        let ctx: EntityGeneratorContext = {
            sample: undefined,
        };

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            ctx.sample = RiverGeometry.getPathPoint(context.path, pathIndex);

            const range = this.placementRange(context, opts.place, ctx.sample);

            const entity = opts.entity(ctx);
            const aggressiveness = Math.min(1.0, context.progress * 0.7 + Math.random() * 0.3);

            this.clipRange(ctx.sample, range, entity.habitat);

            context.placements.push({
                index: pathIndex,
                range: range,
                aggressiveness,
                entity: entity
            });
        }
    }

    private static _staggered(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        let ctx: EntityGeneratorContext = {
            sample: undefined,
        };

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            ctx.sample = RiverGeometry.getPathPoint(context.path, pathIndex);

            const range = this.placementRange(context, opts.place, ctx.sample,
                j % 2 === 0 ? 'left' : 'right');

            const entity = opts.entity(ctx);
            const aggressiveness = Math.min(1.0, context.progress * 0.7 + Math.random() * 0.3);

            this.clipRange(ctx.sample, range, entity.habitat);

            context.placements.push({
                index: pathIndex,
                range: range,
                aggressiveness,
                entity: entity
            });
        }
    }

    private static _gate(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        let ctx: EntityGeneratorContext = {
            sample: undefined,
        };

        for (let j = 0; j < count; j++) {
            const subCount = Math.ceil(count / 2);
            const step = Math.floor(j / 2);
            const pathIndex = context.range[0] + (step + 0.5) * (context.range[1] - context.range[0]) / subCount;
            ctx.sample = RiverGeometry.getPathPoint(context.path, pathIndex);

            const range = this.placementRange(context, opts.place, ctx.sample,
                j % 2 === 0 ? 'left' : 'right');

            const entity = opts.entity(ctx);
            const aggressiveness = Math.min(1.0, context.progress * 0.7 + Math.random() * 0.3);

            this.clipRange(ctx.sample, range, entity.habitat);

            context.placements.push({
                index: pathIndex,
                range: range,
                aggressiveness,
                entity: entity
            });
        }
    }

    private static _cluster(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        let ctx: EntityGeneratorContext = {
            sample: undefined,
        };

        for (let j = 0; j < count; j++) {
            const center = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            const jitter = (Math.random() - 0.5) * 5.0;
            const pathIndex = Math.max(context.range[0], Math.min(context.range[1], center + jitter));
            ctx.sample = RiverGeometry.getPathPoint(context.path, pathIndex);

            const range = this.placementRange(context, opts.place, ctx.sample);

            const entity = opts.entity(ctx);
            const aggressiveness = Math.min(1.0, context.progress * 0.7 + Math.random() * 0.3);

            this.clipRange(ctx.sample, range, entity.habitat);

            context.placements.push({
                index: pathIndex,
                range: range,
                aggressiveness,
                entity: entity
            });
        }
    }

    private static clipRange(
        pathPoint: PathPoint,
        range: [number, number],
        habitat: Habitat
    ) {
        if (habitat === 'water') {
            range[0] = Math.max(-pathPoint.bankDist, range[0]);
            range[1] = Math.min(range[1], pathPoint.bankDist);
        } else if (habitat === 'land') {
            if (range[0] < -pathPoint.bankDist)
                range[1] = Math.min(-pathPoint.bankDist, range[1]);
            if (range[1] > pathPoint.bankDist)
                range[0] = Math.max(range[0], pathPoint.bankDist);
        }
    }

    private static placementRange(
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

    private static getDensity(density: [number, number] | undefined, progress: number): number {
        if (density === undefined) return 1.0;
        return density[0] + progress * (density[1] - density[0]);
    }
}
