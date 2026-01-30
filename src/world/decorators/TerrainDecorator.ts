import { PoissonDecorationStrategy, DecorationRule, WorldMap } from './PoissonDecorationStrategy';
import { PlacementManifest, SpatialGrid } from '../../managers/SpatialGrid';
export type { DecorationRule, PlacementManifest };
import { RiverSystem } from '../RiverSystem';
import { SimplexNoise } from '../SimplexNoise';
import { DecorationContext } from './DecorationContext';
import { DecorationInstance, Decorations, LSystemTreeKind, LSystemFlowerKind } from '../Decorations';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { MathUtils } from '../../core/MathUtils';

export interface TreeDecorationOptions {
    kind: LSystemTreeKind
    rotation: number;
    scale: number;
    color?: number;
    isSnowy?: boolean;
    isLeafLess?: boolean;
}

export interface FlowerDecorationOptions {
    kind: LSystemFlowerKind
    rotation: number;
    scale: number;
    color?: number;
}

export interface RockDecorationOptions {
    kind: 'rock';
    rotation: number;
    scale: number;
    rockBiome?: string;
}

export interface CactusDecorationOptions {
    kind: 'cactus';
    rotation: number;
    scale: number;
}

export type DecorationOptions =
    TreeDecorationOptions
    | FlowerDecorationOptions
    | RockDecorationOptions
    | CactusDecorationOptions
    | { kind: 'cycad', rotation: number, scale: number }
    | { kind: 'treeFern', rotation: number, scale: number };

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
        context: DecorationContext,
        config: DecorationConfig,
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0,
    ): Generator<void | Promise<void>, void, unknown> {
        const placements = yield* this.generateIterator(config, region, spatialGrid, seed);
        yield* this.populateIterator(context, placements, region);
    }

    public static generateIterator(
        config: DecorationConfig,
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0,
    ): Generator<void | Promise<void>, PlacementManifest[], unknown> {
        return this.instance().generateIterator(config, region, spatialGrid, seed);
    }

    public static populateIterator(
        context: DecorationContext, decorations: PlacementManifest[],
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
        spatialGrid: SpatialGrid,
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
        context: DecorationContext, decorations: PlacementManifest[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
    ): Generator<void | Promise<void>, void, unknown> {

        // Similar logic to BiomeDecorationHelper, this instances with
        // distance from river and a visibility check
        const tryPlace = (instances: DecorationInstance[], pos: { worldX: number, worldZ: number, height: number }, opts: DecorationOptions) => {
            const riverSystem = this.riverSystem;
            const riverWidth = riverSystem.getRiverWidth(pos.worldZ);
            const riverCenter = riverSystem.getRiverCenter(pos.worldZ);
            const distFromCenter = Math.abs(pos.worldX - riverCenter);
            const distFromBank = distFromCenter - riverWidth / 2;

            // Apply distance-based probability bias
            const fadeStart = 30;
            if (distFromBank > fadeStart) {
                const fadeDistance = 200 - (fadeStart + riverWidth / 2);
                // 0 at 60 units from bank, 1 at edge of chunk
                const t = MathUtils.clamp(0, 1, (distFromBank - fadeStart) / fadeDistance);
                const probability = Math.max(0.1, Math.pow(1 - t, 2));
                if (Math.random() > probability) return false;
            }

            const height = context.decoHelper.calculateHeight(instances);
            const queryHeight = height + (height * 1.2);

            if (!riverSystem.terrainGeometry.checkVisibility(pos.worldX, queryHeight, pos.worldZ, /* visibilitySteps=*/8)) {
                return;
            }
            context.decoHelper.addInstancedDecoration(context, instances, pos, opts.rotation, opts.scale);

            // Record stats
            if (context.stats) {
                const species = opts.kind;
                context.stats.set(species, (context.stats.get(species) || 0) + 1);
            }
        }

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

            const opts: DecorationOptions = manifest.options as DecorationOptions;

            switch (opts.kind) {
                case 'oak':
                case 'willow':
                case 'poplar':
                case 'birch':
                case 'elder':
                case 'elm':
                case 'umbrella':
                case 'open':
                case 'irregular':
                case 'vase': {
                    const treeInstances = Decorations.getLSystemTreeInstance({
                        kind: opts.kind,
                        leafColor: opts.color,
                        isSnowy: opts.isSnowy,
                        isLeafLess: opts.isLeafLess
                    });
                    tryPlace(treeInstances, pos, opts);
                    break;
                }
                case 'daisy':
                case 'lily':
                case 'waterlily': {
                    const flowerInstances = Decorations.getLSystemFlowerInstance({
                        kind: opts.kind,
                        petalColor: opts.color ?? 0xffffff
                    });
                    tryPlace(flowerInstances, pos, opts);
                    break;
                }
                case 'rock': {
                    const rockInstances = Decorations.getRockInstance(opts.rockBiome ?? 'happy', opts.scale);
                    tryPlace(rockInstances, pos, opts);
                    break;
                }
                case 'cactus': {
                    const cactusInstances = Decorations.getCactusInstance();
                    tryPlace(cactusInstances, pos, opts);
                    break;
                }
                case 'cycad': {
                    const cycadInstances = Decorations.getCycadInstance();
                    tryPlace(cycadInstances, pos, opts);
                    break;
                }
                case 'treeFern': {
                    const treeFernInstances = Decorations.getTreeFernInstance();
                    tryPlace(treeFernInstances, pos, opts);
                    break;
                }
            }
        }
    }
}
