import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { BoatPathLayoutConfig, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { DecorationConfig, DecorationRule } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { Fitness, RockParams, TreeParams } from '../decorations/DecorationRules';
import { SkyBiome } from './BiomeFeatures';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { MooseRule, BrownBearRule, DucklingRule } from '../../entities/AnimalEntityRules';
import { LogRule, RiverRockRule, WaterGrassRule, BottleRule } from '../../entities/StaticEntityRules';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, ForestBiomeFeatures.LENGTH, direction);
    }


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
                        preference: Fitness.make({
                            stepDistance: [60, 70],
                            stepNoise: { scale: 123.4, threshold: 0.95 }
                        }),
                        params: TreeParams.elder({ paletteName: 'fall_yellow' })
                    },
                    {
                        id: 'birch_tree',
                        preference: Fitness.make({
                            stepNoise: { scale: 50, threshold: 0.5 },
                            stepDistance: [5, 200]
                        }),
                        params: TreeParams.birch({ paletteName: 'fall_yellow' })
                    },
                    {
                        id: 'oak_tree',
                        preference: Fitness.make({
                            fitness: 0.9,
                            stepDistance: [5, 200]
                        }),
                        params: TreeParams.oak({ paletteName: 'fall_red_orange' })
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: Fitness.make({
                            fitness: 0.2, minFitness: 0.02, stepDistance: [2, 10]
                        }),
                        params: RockParams.rock()
                    }
                ]
            })
        ]
    };

    public getDecorationConfig(): DecorationConfig {
        return this.decorationConfig;
    }

    protected getLayoutConfig(): BoatPathLayoutConfig {
        const tracks: TrackConfig[] = [{
            name: 'obstacles',
            stages: [{
                name: 'forest_chaos',
                progress: [0, 1.0],
                scenes: [{
                    length: [100, 200], patterns: [
                        Place.sequence_path(LogRule.get(), [0.3, 0.4]),
                        Place.scatter_slalom(RiverRockRule.get('forest'), [1.0, 3.0])
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

        return {
            tracks,
            path: {
                length: [200, 100]
            }
        };
    }

}
