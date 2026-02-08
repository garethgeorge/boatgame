import { PopulationContext } from './PopulationContext';
import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { BoatPathLayoutConfig, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/DecorationRuleBuilders';
import { SkyBiome } from './BiomeFeatures';
import { Placements } from '../layout/BoatPathLayoutPatterns';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { AlligatorRule, MonkeyRule, HippoRule } from '../../entities/AnimalLayoutRules';
import { BottleRule, RiverRockRule, PierRule } from '../../entities/StaticLayoutRules';
import { Fitness, RockParams, PlantParams } from '../decorations/SceneryRules';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, DesertBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        const c0 = { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
        const c1 = { r: 0xD3 / 255, g: 0x59 / 255, b: 0x24 / 255 };

        // Vary color based on height (elevation bands)
        // Higher ground is darker/redder
        const heightFactor = Math.max(0, Math.min(1, y / 20));
        return {
            r: c0.r + (c1.r - c0.r) * heightFactor,
            g: c0.g + (c1.g - c0.g) * heightFactor,
            b: c0.b + (c1.b - c0.b) * heightFactor,
        };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
    }

    public getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x00aaff, bottom: 0xb0e0ff },
            sunset: { top: 0x1a2b4d, mid: 0xff4500, bottom: 0xffd700 },
            night: { top: 0x02040a, bottom: 0x0a1128 },
            haze: 0.2
        };
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            const rules = [
                new TierRule({
                    species: [
                        {
                            id: 'cactus',
                            preference: Fitness.make({
                                fitness: 0.2,
                                stepDistance: [5, 100],
                                slope: [0, 30]
                            }),
                            params: PlantParams.cactus()
                        }
                    ]
                }),
                new TierRule({
                    species: [
                        {
                            id: 'rock',
                            preference: Fitness.make({
                                fitness: 0.1,
                                stepDistance: [3, 20],
                                slope: [0, 70]
                            }),
                            params: RockParams.rock({ rockBiome: 'desert' })
                        }
                    ]
                })
            ];

            this.decorationConfig = { rules, maps: {} };
        }
        return this.decorationConfig;
    }

    protected getLayoutConfig(): BoatPathLayoutConfig {
        const tracks: TrackConfig[] = [
            {
                name: 'main',
                stages: [{
                    name: 'intro',
                    progress: [0, 0.4], scenes: [{
                        length: [50, 100], patterns: [
                            Place.sequence_slalom(RiverRockRule.get('desert'), [0.5, 2.0])
                        ]
                    },
                    {
                        length: [50, 100], patterns: [
                            Place.staggered_slalom(RiverRockRule.get('desert'), [0.5, 2.0], { minCount: 3 })
                        ]
                    }]
                },
                {
                    name: 'gauntlet',
                    progress: [0.3, 0.9], scenes: [{
                        length: [100, 200], patterns: [
                            Place.sequence_nearShore([AlligatorRule.get(), MonkeyRule.get()], [0.5, 4.0]),
                            Place.sequence_slalom(RiverRockRule.get('desert'), [0.5, 2.0])
                        ]
                    },
                    {
                        length: [100, 200], patterns: [
                            Place.cluster_nearShore(HippoRule.get(), [0.3, 2.0], { minCount: 2 }),
                            Place.staggered_slalom(RiverRockRule.get('desert'), [0.5, 2.0], { minCount: 3 })
                        ]
                    }]
                }]
            },
            {
                name: 'unique_elements',
                placements: [
                    {
                        name: 'dock', at: 0.95,
                        placement: Placements.atShore({ entity: PierRule.get(true) })
                    }
                ]
            },
            {
                name: 'rewards',
                stages: [{
                    name: 'bottles',
                    progress: [0.0, 0.9],
                    scenes: [{
                        length: [100, 300], patterns: [
                            Place.cluster_path(BottleRule.get(), [1.5, 0.5], { minCount: 3 })
                        ]
                    }]
                }]
            }
        ];

        return {
            tracks,
            path: {
                length: [200, 100]
            }
        };
    }


}
