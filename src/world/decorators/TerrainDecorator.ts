import { PoissonDecorationStrategy, DecorationRule } from './PoissonDecorationStrategy';
import { PlacementManifest, SpatialGrid } from '../../managers/SpatialGrid';
export type { DecorationRule, PlacementManifest };
import { RiverSystem } from '../RiverSystem';
import { SimplexNoise } from '../SimplexNoise';
import { DecorationContext } from './DecorationContext';
import { DecorationInstance, Decorations, LSystemTreeKind } from '../Decorations';

export interface DecorationOptions {
    kind: LSystemTreeKind | 'flower' | 'rock';
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

    public static decorate(
        context: DecorationContext,
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0
    ) {
        const placements = this.generate(rules, region, spatialGrid, seed);
        this.populate(context, placements, region);
    }

    public static generate(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0
    ): PlacementManifest[] {
        return this.instance().generate(rules, region, spatialGrid, seed);
    }

    public static populate(
        context: DecorationContext, decorations: PlacementManifest[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
    ) {
        this.instance().populate(context, decorations, region);
    }

    constructor() {
        const noise2D = new SimplexNoise();
        this.strategy = new PoissonDecorationStrategy(noise2D);
        this.riverSystem = RiverSystem.getInstance();
    }

    private generate(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        spatialGrid: SpatialGrid,
        seed: number = 0
    ): PlacementManifest[] {

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

        return this.strategy.generate(
            rules,
            region,
            spatialGrid,
            terrainProvider,
            biomeProgressProvider,
            seed
        );
    }

    private populate(
        context: DecorationContext, decorations: PlacementManifest[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
    ) {
        const tryPlace = (instances: DecorationInstance[], pos: { worldX: number, worldZ: number, height: number }, opts: DecorationOptions) => {
            const height = context.decoHelper.calculateHeight(instances);
            const queryHeight = height + (height * 1.2);

            if (!this.riverSystem.terrainGeometry.checkVisibility(pos.worldX, queryHeight, pos.worldZ, /* visibilitySteps=*/8)) {
                return;
            }
            context.decoHelper.addInstancedDecoration(context, instances, pos, opts.rotation, opts.scale);
        }

        for (const manifest of decorations) {
            if (!(region.xMin <= manifest.position.x && manifest.position.x < region.xMax)) continue;
            if (!(region.zMin <= manifest.position.z && manifest.position.z < region.zMax)) continue;

            const wx = manifest.position.x;
            const wz = manifest.position.z;
            const height = manifest.position.y;

            // Visibility Check: Only instantiate if visible from the river
            const visibilitySteps = 8;
            if (!this.riverSystem.terrainGeometry.checkVisibility(wx, height, wz, visibilitySteps)) {
                continue;
            }

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
                    const treeInstances = Decorations.getLSystemTreeInstance({ kind: opts.kind as any });
                    tryPlace(treeInstances, pos, opts);
                    break;
                }
                case 'flower': {
                    const flowerInstances = Decorations.getFlowerInstance();
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
