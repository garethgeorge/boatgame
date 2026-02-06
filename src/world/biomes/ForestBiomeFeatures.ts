import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { BoatPathLayout, BoatPathLayoutConfig, BoatPathLayoutStrategy, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from '../layout/BoatPathLayoutSpawner';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { DecoRules } from '../decorations/DecoRules';
import { Decorations } from '../decorations/Decorations';
import { SkyBiome } from './BiomeFeatures';
import { Placements, Patterns } from '../layout/BoatPathLayoutPatterns';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { EntityRules } from '../layout/EntityLayoutRules';
import { MooseRule, BrownBearRule, DucklingRule } from '../../entities/AnimalEntityRules';
import { LogRule, RockRule, PierRule, WaterGrassRule, BottleRule } from '../../entities/StaticEntityRules';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, ForestBiomeFeatures.LENGTH, direction);
    }

    private spatialGrid: SpatialGrid = new SpatialGrid(20);
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 };
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x4080ff, bottom: 0xc0d8ff },
            sunset: { top: 0x2e1a47, mid: 0xc71585, bottom: 0xff8c00 },
            night: { top: 0x050a15, bottom: 0x1a1a2e },
            haze: 0.5
        };
    }

    private decorationConfig: DecorationConfig = {
        maps: {},
        rules: [
            new TierRule({
                species: [
                    {
                        id: 'elder_tree',
                        preference: DecoRules.fitness({
                            stepDistance: [60, 70],
                            stepNoise: { scale: 123.4, threshold: 0.95 }
                        }),
                        params: DecoRules.elder_tree({ paletteName: 'fall_yellow' })
                    },
                    {
                        id: 'birch_tree',
                        preference: DecoRules.fitness({
                            stepNoise: { scale: 50, threshold: 0.5 },
                            stepDistance: [5, 200]
                        }),
                        params: DecoRules.birch_tree({ paletteName: 'fall_yellow' })
                    },
                    {
                        id: 'oak_tree',
                        preference: DecoRules.fitness({
                            fitness: 0.9,
                            stepDistance: [5, 200]
                        }),
                        params: DecoRules.oak_tree({ paletteName: 'fall_red_orange' })
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: DecoRules.fitness({
                            fitness: 0.2, minFitness: 0.02, stepDistance: [2, 10]
                        }),
                        params: DecoRules.rock()
                    }
                ]
            })
        ]
    };

    public getDecorationConfig(): DecorationConfig {
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const tracks: TrackConfig[] = [{
            name: 'obstacles',
            stages: [{
                name: 'forest_chaos',
                progress: [0, 1.0],
                scenes: [{
                    length: [100, 200], patterns: [
                        Place.sequence_path(LogRule.get(), [0.3, 0.4]),
                        Place.scatter_slalom(RockRule.get('forest'), [1.0, 3.0])
                    ]
                },
                {
                    length: [100, 200], patterns: [
                        Place.scatter_nearShore([MooseRule.get(), BrownBearRule.get()], [0.5, 1.0]),
                        Place.scatter_middle(WaterGrassRule.get(), [1.5, 3.0])
                    ]
                },
                {
                    length: [100, 200], patterns: [
                        Place.sequence_nearShore(DucklingRule.get(), [0.3, 0.3]),
                        Place.scatter_middle(WaterGrassRule.get(), [1.5, 3.0])
                    ]
                }]
            }]
        },
        {
            name: 'collectables',
            stages: [{
                name: 'bottles',
                progress: [0, 1.0],
                scenes: [{
                    length: [200, 500], patterns: [
                        Place.scatter_path(BottleRule.get(), [0.2, 0.5])
                    ]
                }]
            }]
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
