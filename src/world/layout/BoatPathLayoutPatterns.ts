import * as THREE from 'three';
import { RiverGeometry } from "../RiverGeometry";
import { PatternConfig, PatternContext } from "./BoatPathLayoutStrategy";
import { LayoutParams, LayoutRule, Habitat, PathPoint } from './LayoutRule';

/**
 * Options shared by the various types of patterns.
 */
export interface CommonPatternOptions {
    /** Placement logic used to position the entity */
    placement: PlacementConfig;
    /** Min and Max density in instances per 100m. Scales from start to end of biome. */
    density?: [number, number];
    /** Minimum required instances */
    minCount?: number;
    /** Maximum allowed instances */
    maxCount?: number;
}

/** Function that tries to place a single instance at a position along the path.
 * Returns true if placement was successful.
 */
export type PlacementConfig = (context: PatternContext, pathIndex: number, side: 'left' | 'right') => boolean;

export interface CommonPlacementOptions {
    /** Generates a candidate entity */
    entity: LayoutRule;
}

type PlacementRangeFn = (context: PatternContext, pathPoint: PathPoint, side?: 'left' | 'right') => [number, number];

export class Placements {
    public static scatter(opts: CommonPlacementOptions): PlacementConfig {
        return (context: PatternContext, pathIndex: number, side: 'left' | 'right') =>
            this._tryPlace(context, this._scatterRange, opts, pathIndex, side);
    }

    public static path(opts: CommonPlacementOptions): PlacementConfig {
        return (context: PatternContext, pathIndex: number, side: 'left' | 'right') =>
            this._tryPlace(context, this._pathRange, opts, pathIndex, side);
    }

    public static slalom(opts: CommonPlacementOptions): PlacementConfig {
        return (context: PatternContext, pathIndex: number, side: 'left' | 'right') =>
            this._tryPlace(context, this._slalomRange, opts, pathIndex, side);
    }

    public static onShore(opts: CommonPlacementOptions): PlacementConfig {
        return (context: PatternContext, pathIndex: number, side: 'left' | 'right') =>
            this._tryPlace(context, this._onShoreRange, opts, pathIndex, side);
    }

    public static nearShore(opts: CommonPlacementOptions): PlacementConfig {
        return (context: PatternContext, pathIndex: number, side: 'left' | 'right') =>
            this._tryPlace(context, this._nearShoreRange, opts, pathIndex, side);
    }

    public static middle(opts: CommonPlacementOptions): PlacementConfig {
        return (context: PatternContext, pathIndex: number, side: 'left' | 'right') =>
            this._tryPlace(context, this._middleRange, opts, pathIndex, side);
    }

    public static atShore(opts: CommonPlacementOptions): PlacementConfig {
        return (context: PatternContext, pathIndex: number, side: 'left' | 'right') =>
            this._tryAtShorePlace(context, opts, pathIndex, side);
    }

    private static _tryAtShorePlace(
        context: PatternContext,
        opts: CommonPlacementOptions,
        pathIndex: number,
        side?: 'left' | 'right'
    ): boolean {
        const sample = RiverGeometry.getPathPoint(context.path, pathIndex);
        if (side === undefined)
            side = Math.random() < 0.5 ? 'left' : 'right';

        const offset = side === 'left' ? sample.bankDist : -sample.bankDist;
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;
        const habitat: Habitat = 'water';

        const layoutContext: LayoutParams = {
            world: context.world,
            sample,
            index: pathIndex,
            offset,
            x, z,
            habitat,
            progress: context.progress,
            is_free: (x, z, r) => !context.spatialGrid.checkCollision(x, z, r, 0),
        };

        const generator = opts.entity(layoutContext);
        if (generator) {
            generator.generate(context.placements);
            return true;
        }
        return false;
    }

    private static _tryPlace(
        context: PatternContext,
        rangeFn: PlacementRangeFn,
        opts: CommonPlacementOptions,
        pathIndex: number,
        side?: 'left' | 'right'
    ): boolean {
        const sample = RiverGeometry.getPathPoint(context.path, pathIndex);
        const range = rangeFn(context, sample, side);

        const layoutContext: LayoutParams = {
            world: context.world,
            sample,
            index: pathIndex,
            offset: 0,
            x: 0, z: 0,
            habitat: 'land',
            progress: context.progress,
            is_free: (x, z, r) => !context.spatialGrid.checkCollision(x, z, r, 0),
        };

        const attempts = 10;
        for (let i = 0; i < attempts; i++) {
            const offset = range[0] + Math.random() * (range[1] - range[0]);
            const x = sample.centerPos.x + sample.normal.x * offset;
            const z = sample.centerPos.z + sample.normal.z * offset;
            const habitat: Habitat = Math.abs(offset) > sample.bankDist ? 'land' : 'water';

            layoutContext.offset = offset;
            layoutContext.x = x;
            layoutContext.z = z;
            layoutContext.habitat = habitat;

            const generator = opts.entity(layoutContext);
            if (generator) {
                generator.generate(context.placements);
                return true;
            }
        }
        return false;
    }

    private static _scatterRange(context: PatternContext, pathPoint: PathPoint, side?: 'left' | 'right'): [number, number] {
        return [-pathPoint.bankDist, pathPoint.bankDist];
    }

    private static _pathRange(context: PatternContext, pathPoint: PathPoint, side?: 'left' | 'right'): [number, number] {
        return [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2];
    }

    private static _slalomRange(context: PatternContext, pathPoint: PathPoint, side?: 'left' | 'right'): [number, number] {
        if (side === undefined) {
            const boatSide = pathPoint.boatXOffset > 0 ? 'right' : 'left';
            side = boatSide === 'right' ? 'left' : 'right';
        }
        return side === 'right' ?
            [pathPoint.boatXOffset + 5.0, pathPoint.bankDist - 2.0] :
            [-pathPoint.bankDist + 2.0, pathPoint.boatXOffset - 5.0];
    }

    private static _onShoreRange(context: PatternContext, pathPoint: PathPoint, side?: 'left' | 'right'): [number, number] {
        side = side ?? (pathPoint.boatXOffset > 0 ? 'left' : 'right');
        return side === 'right' ?
            [pathPoint.bankDist, pathPoint.bankDist + 15] :
            [-pathPoint.bankDist - 15, -pathPoint.bankDist];
    }

    private static _nearShoreRange(context: PatternContext, pathPoint: PathPoint, side?: 'left' | 'right'): [number, number] {
        side = side ?? (pathPoint.boatXOffset > 0 ? 'left' : 'right');
        return side === 'right' ?
            [0.5 * pathPoint.bankDist, pathPoint.bankDist + 15] :
            [-pathPoint.bankDist - 15, 0.5 * -pathPoint.bankDist];
    }

    private static _middleRange(context: PatternContext, pathPoint: PathPoint, side?: 'left' | 'right'): [number, number] {
        side = side ?? (pathPoint.boatXOffset > 0 ? 'left' : 'right');
        return side === 'right' ?
            [0, 0.5 * pathPoint.bankDist] :
            [0.5 * -pathPoint.bankDist, 0];
    }
}

export class Patterns {
    public static none(): PatternConfig {
        return (context: PatternContext) => { };
    }

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
            opts.placement(context, pathIndex, Math.random() < 0.5 ? 'left' : 'right');
        }
    }

    private static _sequence(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            opts.placement(context, pathIndex, Math.random() < 0.5 ? 'left' : 'right');
        }
    }

    private static _staggered(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            opts.placement(context, pathIndex, j % 2 === 0 ? 'left' : 'right');
        }
    }

    private static _gate(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const subCount = Math.ceil(count / 2);
            const step = Math.floor(j / 2);
            const pathIndex = context.range[0] + (step + 0.5) * (context.range[1] - context.range[0]) / subCount;
            opts.placement(context, pathIndex, j % 2 === 0 ? 'left' : 'right');
        }
    }

    private static _cluster(context: PatternContext, opts: CommonPatternOptions) {
        const count = this.getCount(context, opts);
        for (let j = 0; j < count; j++) {
            const center = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            const jitter = (Math.random() - 0.5) * 5.0;
            const pathIndex = Math.max(context.range[0], Math.min(context.range[1], center + jitter));
            opts.placement(context, pathIndex, Math.random() < 0.5 ? 'left' : 'right');
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
}
