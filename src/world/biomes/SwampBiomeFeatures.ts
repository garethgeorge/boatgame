import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { PopulationContext } from './PopulationContext';
import { BoatPathLayout, BoatPathLayoutConfig, BoatPathLayoutStrategy, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { BoatPathLayoutSpawner } from '../layout/BoatPathLayoutSpawner';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { Fitness, MangroveParams } from '../decorations/DecoRules';
import { SkyBiome } from './BiomeFeatures';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { SnakeRule, EgretRule, DragonflyRule, AlligatorRule } from '../../entities/AnimalEntityRules';
import { MangroveRule, BottleRule, LogRule, WaterGrassRule, LilyPadPatchRule } from '../../entities/StaticEntityRules';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';
    private static readonly LENGTH = 1600;

    constructor(index: number, z: number, direction: number) {
        super(index, z, SwampBiomeFeatures.LENGTH, direction);
    }

    private spatialGrid: SpatialGrid = new SpatialGrid(20);
    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0x2B / 255, g: 0x24 / 255, b: 0x1C / 255 }; // Muddy Dark Brown
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xB0 / 255, g: 0xA0 / 255, b: 0xD0 / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 300 };
    }


    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x556b2f, bottom: 0xf5f5dc },
            sunset: { top: 0x221100, mid: 0x808000, bottom: 0xbdb76b },
            night: { top: 0x050805, bottom: 0x1e2410 },
            haze: 1.0
        };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.1 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    getRiverWidthMultiplier(): number {
        return 5.0;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const tracks: TrackConfig[] = [{
            name: 'vegetation',
            stages: [{
                name: 'mangroves',
                progress: [0.0, 1.0],
                scenes: [{
                    length: [50, 150], patterns: [
                        Place.scatter_nearShore(MangroveRule.get(), [20, 40], { minCount: 15 })
                    ]
                }]
            }]
        },
        {
            name: 'rewards',
            stages: [{
                name: 'bottles',
                progress: [0.0, 1.0],
                scenes: [{
                    length: [200, 500], patterns: [
                        Place.sequence_path(BottleRule.get(), [0.5, 0.5])
                    ]
                }]
            }]
        },
        {
            name: 'threats',
            stages: [{
                name: 'threats',
                progress: [0.2, 1.0],
                scenes: [{
                    length: [150, 300], patterns: [
                        Place.scatter_path([AlligatorRule.get(), SnakeRule.get()], [0.25, 1.5])
                    ]
                }]
            }]
        },
        {
            name: 'friends',
            stages: [{
                name: 'friends',
                progress: [0.0, 1.0],
                scenes: [{
                    length: [100, 300], patterns: [
                        Place.scatter_path(EgretRule.get(), [1, 2])
                    ]
                },
                {
                    length: [100, 300], patterns: [
                        Place.cluster_path(DragonflyRule.get(), [0.5, 1], { minCount: 2, maxCount: 3 })
                    ]
                }]
            }]
        },
        {
            name: 'obstacles',
            stages: [{
                name: 'standard',
                progress: [0.0, 1.0],
                scenes: [{
                    length: [100, 200], patterns: [
                        Place.scatter_slalom(LogRule.get(), [0.5, 2.0]),
                        Place.scatter_middle(LilyPadPatchRule.get(), [2.0, 5.0]),
                        Place.scatter_nearShore(WaterGrassRule.get(), [1.5, 3.0])
                    ]
                },
                {
                    length: [100, 200], patterns: [
                        Place.scatter_middle(LilyPadPatchRule.get(), [2.0, 5.0])
                    ]
                }]
            }]
        }];

        const config: BoatPathLayoutConfig = {
            tracks,
            path: {
                length: [200, 100]
            }
        };

        this.layoutCache = BoatPathLayoutStrategy.createLayout(
            [this.zMin, this.zMax], config, this.spatialGrid);
        return this.layoutCache;
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            const rules: DecorationRule[] = [
                new TierRule({
                    species: [
                        {
                            id: 'mangrove',
                            preference: Fitness.make({
                                fitness: 1.0,
                                stepDistance: [5, 55],
                            }),
                            params: MangroveParams.mangrove()
                        }
                    ]
                }),
            ];
            this.decorationConfig = { rules, maps: {} };
        }
        return this.decorationConfig;
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

