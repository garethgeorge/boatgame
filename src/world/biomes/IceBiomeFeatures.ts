import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { PopulationContext } from './PopulationContext';
import { Decorations } from '../decorations/Decorations';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule, Combine, Signal } from '../decorators/PoissonDecorationRules';
import { EntityIds } from '../../entities/EntityIds';
import { Fitness, RockParams, TreeParams } from '../decorations/DecorationRules';
import { SkyBiome } from './BiomeFeatures';
import { Placements, Patterns } from '../layout/BoatPathLayoutPatterns';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { EntityRules } from '../layout/EntityLayoutRules';
import { PolarBearRule, PenguinKayakRule, NarwhalRule } from '../../entities/AnimalEntityRules';
import { IcebergRule, BuoyRule, BottleRule } from '../../entities/StaticEntityRules';
import { BoatPathLayoutSpawner } from '../layout/BoatPathLayoutSpawner';
import { BoatPathLayout, BoatPathLayoutConfig, BoatPathLayoutStrategy, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';

export class IceBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'ice';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, IceBiomeFeatures.LENGTH, direction);
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 };
    }
    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 400 };
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0xa0c0f0, bottom: 0xe0f0ff },
            sunset: { top: 0x203050, mid: 0x9370db, bottom: 0xffb6c1 },
            night: { top: 0x010510, bottom: 0x102040 },
            haze: 0.1
        };
    }

    getRiverWidthMultiplier(): number {
        return 2.3;
    }

    private spatialGrid: SpatialGrid = new SpatialGrid(20);
    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

    public getDecorationConfig(): DecorationConfig {
        if (this.decorationConfig) return this.decorationConfig;

        const rules = [
            new TierRule({
                species: [
                    {
                        id: 'oak_tree',
                        preference: Fitness.make({
                            fitness: 0.6,
                            stepDistance: [10, 200],
                            slope: [0, 30]
                        }),
                        params: TreeParams.oak({ snow: true, leaves: 0.5 })
                    },
                    {
                        id: 'elm_tree',
                        preference: Fitness.make({
                            fitness: 0.4,
                            stepDistance: [10, 60],
                            slope: [0, 25]
                        }),
                        params: TreeParams.elm()
                    },
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: Fitness.make({
                            fitness: 0.1
                        }),
                        params: RockParams.rock({ rockBiome: 'ice' })
                    },
                ]
            })
        ];

        this.decorationConfig = { rules, maps: {} };
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const tracks: TrackConfig[] = [{
            name: 'obstacles',
            stages: [{
                name: 'ice_gauntlet',
                progress: [0, 1.0],
                scenes: [{
                    length: [100, 200], patterns: [
                        Place.scatter_slalom(IcebergRule.get(), [1.0, 3.0]),
                        Place.scatter_middle(BuoyRule.get(), [0.5, 1.5]),
                        Place.scatter_slalom(NarwhalRule.get(), [0.5, 1.0])
                    ]
                },
                {
                    length: [100, 200], patterns: [
                        Place.scatter_path(BottleRule.get(), [0.25, 0.25]),
                        Place.scatter_nearShore([PolarBearRule.get(), PenguinKayakRule.get()], [0.5, 0.5])
                    ]
                }]
            }],
        }];

        this.layoutCache = BoatPathLayoutStrategy.createLayout([this.zMin, this.zMax], {
            tracks,
            path: {
                length: [200, 100]
            }
        }, this.spatialGrid);

        return this.layoutCache;
    }

    * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // 1. Get entity layout creating it if needed
        const layout = this.getLayout();

        // 2. Decorate
        const decorationConfig = this.getDecorationConfig();

        // decorations are inserted into the chunk grid but checked for
        // collisions against the layout grid for the entire biome
        const spatialGrid = new SpatialGridPair(
            context.chunk.spatialGrid,
            this.spatialGrid
        );

        yield* TerrainDecorator.decorateIterator(
            context,
            decorationConfig,
            { xMin: -250, xMax: 250, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 + zStart // Seed variation
        );

        // 3. Spawn
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
