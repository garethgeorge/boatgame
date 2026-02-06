import * as THREE from 'three';
import { PoissonDecorationStrategy, DecorationRule, WorldMap } from './PoissonDecorationStrategy';
import { PlacementManifest, AnySpatialGrid } from '../../core/SpatialGrid';
export type { DecorationRule, PlacementManifest };
import { RiverSystem } from '../RiverSystem';
import { SimplexNoise } from '../../core/SimplexNoise';
import { PopulationContext } from '../biomes/PopulationContext';
import { DecorationInstance, Decorations, LSystemTreeKind, LSystemFlowerKind } from '../decorations/Decorations';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { MathUtils } from '../../core/MathUtils';


export interface DecorationContext {
    tryPlaceInstances(
        instances: DecorationInstance[],
        pos: { worldX: number, worldZ: number, height: number },
        opts: DecorationOptions);

    tryPlaceObject(
        object: THREE.Object3D,
        pos: { worldX: number, worldZ: number, height: number },
        opts: DecorationOptions
    );
}

export type DecoratorFunction = (ctx: DecorationContext,
    pos: { worldX: number, worldZ: number, height: number },
    opts: DecorationOptions) => void;

export type DecorationKind =
    LSystemTreeKind
    | LSystemFlowerKind
    | 'rock'
    | 'cactus'
    | 'cycad'
    | 'treeFern'
    | 'mangrove'
    | 'beachChair'
    | 'beachUmbrella';

/**
 * Type specific options have a function to place the instance
 */
export interface DecorationOptions {
    place: DecoratorFunction;
    kind: DecorationKind,
    rotation: number;
    scale: number;
}

export class NoiseMap implements WorldMap {
    private noise: SimplexNoise;
    private sx: number;
    private sy: number;
    private dx: number;
    private dy: number;

    constructor(noise: SimplexNoise, sx: number, sy: number,
        dx: number = Math.random(), dy: number = Math.random()) {
        this.noise = noise;
        this.sx = sx;
        this.sy = sy;
        this.dx = dx;
        this.dy = dy;
    }

    sample(x: number, y: number): number {
        return (this.noise.noise2D(x / this.sx + this.dx, y / this.sy + this.dy) + 1) / 2.0;
    }
}

export interface DecorationConfig {
    maps: Record<string, WorldMap>,
    rules: DecorationRule[]
};

export class TerrainDecorator {
    private static _instance: TerrainDecorator;

    private strategy: PoissonDecorationStrategy;
    private riverSystem: RiverSystem;

    public static instance(): TerrainDecorator {
        if (!this._instance) this._instance = new TerrainDecorator;
        return this._instance;
    }

    public static *decorateIterator(
        context: PopulationContext,
        config: DecorationConfig,
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: AnySpatialGrid,
        seed: number = 0,
    ): Generator<void | Promise<void>, void, unknown> {
        const placements = yield* this.generateIterator(config, region, spatialGrid, seed);
        yield* this.populateIterator(context, placements, region);
    }

    public static generateIterator(
        config: DecorationConfig,
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: AnySpatialGrid,
        seed: number = 0,
    ): Generator<void | Promise<void>, PlacementManifest[], unknown> {
        return this.instance().generateIterator(config, region, spatialGrid, seed);
    }

    public static populateIterator(
        context: PopulationContext, decorations: PlacementManifest[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
    ): Generator<void | Promise<void>, void, unknown> {
        return this.instance().populateIterator(context, decorations, region);
    }

    constructor() {
        const noise2D = new SimplexNoise();
        this.strategy = new PoissonDecorationStrategy(noise2D);
        this.riverSystem = RiverSystem.getInstance();
    }

    private *generateIterator(
        config: DecorationConfig,
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: AnySpatialGrid,
        seed: number = 0,
    ): Generator<void | Promise<void>, PlacementManifest[], unknown> {

        // Default Terrain Provider using RiverSystem
        const terrainProvider = (x: number, z: number) => {
            const height = this.riverSystem.terrainGeometry.calculateHeight(x, z);
            const normal = this.riverSystem.terrainGeometry.calculateNormal(x, z);

            // Approximate distToRiver logic
            const riverCenter = this.riverSystem.getRiverCenter(z);
            const distToCenter = Math.abs(x - riverCenter);
            const riverWidth = this.riverSystem.getRiverWidth(z);
            const distToRiver = distToCenter - riverWidth / 2;

            // Slope calculation (angle in radians)
            const slope = Math.acos(Math.max(-1, Math.min(1, normal.y)));

            return { height, slope, distToRiver };
        };

        const zStart = region.zMax;
        const zEnd = region.zMin;
        const totalLen = Math.abs(zStart - zEnd) || 1; // avoid /0

        const biomeProgressProvider = (z: number) => {
            return (zStart - z) / totalLen;
        };

        return yield* this.strategy.generateIterator(
            config.rules,
            region,
            spatialGrid,
            terrainProvider,
            biomeProgressProvider,
            seed,
            config.maps
        );
    }

    private *populateIterator(
        context: PopulationContext, decorations: PlacementManifest[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
    ): Generator<void | Promise<void>, void, unknown> {

        const self = this;
        const ctx: DecorationContext = {
            tryPlaceInstances(
                instances: DecorationInstance[],
                pos: { worldX: number, worldZ: number, height: number },
                opts: DecorationOptions) {
                self.tryPlaceInstances(context, instances, pos, opts);
            },
            tryPlaceObject(
                object: THREE.Object3D,
                pos: { worldX: number, worldZ: number, height: number },
                opts: DecorationOptions
            ) {
                self.tryPlaceObject(context, object, pos, opts);
            }
        };

        let countSinceYield = 0;
        for (const manifest of decorations) {
            countSinceYield++;
            if (countSinceYield > 20) {
                yield;
                countSinceYield = 0;
            }

            if (!(region.xMin <= manifest.position.x && manifest.position.x < region.xMax)) continue;
            if (!(region.zMin <= manifest.position.z && manifest.position.z < region.zMax)) continue;

            const wx = manifest.position.x;
            const wz = manifest.position.z;
            const height = manifest.position.y;

            const pos = {
                worldX: wx,
                worldZ: wz,
                height: height
            };

            const options: DecorationOptions = manifest.options as DecorationOptions;
            options.place(ctx, pos, options);
        }
    }

    private tryPlaceObject(
        context: PopulationContext,
        object: THREE.Object3D,
        pos: { worldX: number, worldZ: number, height: number },
        opts: DecorationOptions
    ) {
        if (!this.distanceFilter(pos))
            return false;

        const height = context.decoHelper.calculateObjectHeight(object);
        if (!this.visibilityFilter(pos, height))
            return false;

        context.decoHelper.positionAndCollectGeometry(object, pos, context);

        // Record stats
        if (context.stats) {
            const species = opts.kind;
            context.stats.set(species, (context.stats.get(species) || 0) + 1);
        }
    }

    private tryPlaceInstances(
        context: PopulationContext,
        instances: DecorationInstance[],
        pos: { worldX: number, worldZ: number, height: number },
        opts: DecorationOptions
    ) {
        if (!this.distanceFilter(pos))
            return false;

        const height = context.decoHelper.calculateInstancesHeight(instances);
        if (!this.visibilityFilter(pos, height))
            return false;

        context.decoHelper.addInstancedDecoration(context, instances, pos, opts.rotation, opts.scale);

        // Record stats
        if (context.stats) {
            const species = opts.kind;
            context.stats.set(species, (context.stats.get(species) || 0) + 1);
        }
    }

    private distanceFilter(
        pos: { worldX: number, worldZ: number, height: number }
    ): boolean {
        const riverSystem = this.riverSystem;
        const riverWidth = riverSystem.getRiverWidth(pos.worldZ);
        const riverCenter = riverSystem.getRiverCenter(pos.worldZ);
        const distFromCenter = Math.abs(pos.worldX - riverCenter);
        const distFromBank = distFromCenter - riverWidth / 2;

        // Apply distance-based probability bias
        const fadeStart = 30;
        if (distFromBank > fadeStart) {
            // Sometimes the river can be very wide
            const fadeDistance = Math.max(200 - (fadeStart + riverWidth / 2), 30);
            // 0 at 60 units from bank, 1 at edge of chunk
            const t = MathUtils.clamp(0, 1, (distFromBank - fadeStart) / fadeDistance);
            const probability = Math.max(0.1, Math.pow(1 - t, 2));
            if (Math.random() > probability) return false;
        }

        return true;
    }

    private visibilityFilter(
        pos: { worldX: number, worldZ: number, height: number },
        height: number
    ) {
        const riverSystem = this.riverSystem;
        const queryHeight = pos.height + (height * 1.2);

        if (!riverSystem.terrainGeometry.checkVisibility(pos.worldX, queryHeight, pos.worldZ, /* visibilitySteps=*/8)) {
            return false;
        }

        return true;
    }
}
