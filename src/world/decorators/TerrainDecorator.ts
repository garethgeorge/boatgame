import { PoissonDecorationStrategy, DecorationRule } from './PoissonDecorationStrategy';
import { PlacementManifest, SpatialGrid } from '../../managers/SpatialGrid';
export type { DecorationRule, PlacementManifest };
import { RiverSystem } from '../RiverSystem';
import { SimplexNoise } from '../SimplexNoise';
import { DecorationContext } from './DecorationContext';
import { DecorationInstance, Decorations, LSystemTreeKind, LSystemFlowerKind } from '../Decorations';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export interface DecorationOptions {
    kind: LSystemTreeKind | LSystemFlowerKind | 'flower' | 'rock';
    rotation: number;
    scale: number;
}

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
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0
    ) {
        const placements = yield* this.generateIterator(rules, region, spatialGrid, seed);
        yield* this.populateIterator(context, placements, region);
    }

    public static generateIterator(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0
    ): Generator<void, PlacementManifest[], unknown> {
        return this.instance().generateIterator(rules, region, spatialGrid, seed);
    }

    public static populateIterator(
        context: DecorationContext, decorations: PlacementManifest[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
    ): Generator<void, void, unknown> {
        return this.instance().populateIterator(context, decorations, region);
    }

    constructor() {
        const noise2D = new SimplexNoise();
        this.strategy = new PoissonDecorationStrategy(noise2D);
        this.riverSystem = RiverSystem.getInstance();
    }

    private *generateIterator(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0
    ): Generator<void, PlacementManifest[], unknown> {

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
            rules,
            region,
            spatialGrid,
            terrainProvider,
            biomeProgressProvider,
            seed
        );
    }

    private *populateIterator(
        context: DecorationContext, decorations: PlacementManifest[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
    ): Generator<void, void, unknown> {

        // Similar logic to BiomeDecorationHelper, this instances with
        // distance from river and a visibility check
        const tryPlace = (instances: DecorationInstance[], pos: { worldX: number, worldZ: number, height: number }, opts: DecorationOptions) => {
            const riverSystem = this.riverSystem;
            const riverWidth = riverSystem.getRiverWidth(pos.worldZ);
            const riverCenter = riverSystem.getRiverCenter(pos.worldZ);
            const distFromCenter = Math.abs(pos.worldX - riverCenter);
            const distFromBank = distFromCenter - riverWidth / 2;

            // Apply distance-based probability bias
            if (distFromBank > 0) {
                const biasDistance = 240; // Tripled from 80 per user request
                const normalizedDist = Math.min(1.0, distFromBank / biasDistance);
                const probability = Math.pow(1.0 - normalizedDist, 2);
                if (Math.random() > probability) return false;
            }

            const height = context.decoHelper.calculateHeight(instances);
            const queryHeight = height + (height * 1.2);

            if (!riverSystem.terrainGeometry.checkVisibility(pos.worldX, queryHeight, pos.worldZ, /* visibilitySteps=*/8)) {
                return;
            }
            context.decoHelper.addInstancedDecoration(context, instances, pos, opts.rotation, opts.scale);
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
                        kind: opts.kind
                    });
                    tryPlace(treeInstances, pos, opts);
                    break;
                }
                case 'daisy':
                case 'lily':
                case 'waterlily': {
                    const flowerInstances = Decorations.getLSystemFlowerInstance({
                        kind: opts.kind,
                        petalColor: GraphicsUtils.getRandomColor(1.0, 0.5)
                    });
                    tryPlace(flowerInstances, pos, opts);
                    break;
                }
                case 'rock': {
                    const rockInstances = Decorations.getRockInstance('happy', opts.scale);
                    tryPlace(rockInstances, pos, opts);
                    break;
                }
            }
        }
    }
}
