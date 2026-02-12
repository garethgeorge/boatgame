import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { BoatPathLayoutConfig, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { DecorationConfig, NoiseMap } from './DecorationConfig';
import { TierRule } from '../decorators/DecorationRuleBuilders';
import { Fitness, RockParams, PlantParams } from '../decorations/SceneryRules';
import { SimplexNoise } from '../../core/SimplexNoise';
import { SkyBiome } from './BiomeFeatures';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { TRexRule, TriceratopsRule, PterodactylRule, BrontosaurusRule } from '../../entities/AnimalLayoutRules';
import { RiverRockRule, LogRule, BottleRule, WaterGrassRule } from '../../entities/StaticLayoutRules';
import { WorldParams } from '../decorators/WorldParams';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, JurassicBiomeFeatures.LENGTH, direction);
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0x2E / 255, g: 0x4B / 255, b: 0x2E / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0x2E / 255, g: 0x4B / 255, b: 0x2E / 255 };
    }
    getFogDensity(): number {
        return 0.3;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 50, far: 600 };
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x2f4f4f, bottom: 0x9eb05d },
            sunset: { top: 0x1a0f00, mid: 0x8b0000, bottom: 0x4b5320 },
            night: { top: 0x020502, bottom: 0x0d1a0d },
            haze: 0.9
        };
    }

    getRiverWidthMultiplier(): number {
        return 1.7;
    }

    public createWorldMaps(): Record<string, NoiseMap> {
        const maps = {
            trees: new NoiseMap(new SimplexNoise(), 300, 300)
        };
        return maps;
    }

    public createDecorationConfig(): DecorationConfig {
        const rules = [
            new TierRule({
                species: [
                    {
                        id: 'cycad',
                        preference: Fitness.make({
                            map: { name: 'trees', range: [0, 0.5] },
                            stepDistance: [5, 100],
                            slope: [0, 30]
                        }),
                        params: PlantParams.cycad()
                    },
                    {
                        id: 'tree_fern',
                        preference: Fitness.make({
                            map: { name: 'trees', range: [0.5, 1] },
                            stepDistance: [10, 100],
                            slope: [0, 25]
                        }),
                        params: PlantParams.tree_fern()
                    },
                    {
                        id: 'rock',
                        preference: Fitness.make({
                            fitness: 0.5,
                            stepDistance: [3, 40],
                            slope: [30, 90]
                        }),
                        params: RockParams.rock({ rockBiome: this.id })
                    }
                ]
            })
        ];

        return { rules };
    }

    public createLayoutConfig(): BoatPathLayoutConfig {
        const tracks: TrackConfig[] = [
            {
                name: 'obstacles',
                stages: [{
                    name: 'danger_zone',
                    progress: [0, 1.0],
                    scenes: [{
                        length: [100, 200], patterns: [
                            Place.scatter_slalom(RiverRockRule.get('jurassic'), [1.0, 3.0]),
                            Place.scatter_nearShore([TRexRule.get(), TriceratopsRule.get()], [0.5, 1.5]),
                            Place.scatter_nearShore(WaterGrassRule.get(), [1.5, 3.0])
                        ]
                    },
                    {
                        length: [100, 200], patterns: [
                            Place.staggered_slalom(LogRule.get(), [0.5, 1.5], { minCount: 4 }),
                            Place.scatter_onShore(PterodactylRule.get(), [0.5, 1.5])
                        ]
                    },
                    {
                        length: [100, 200], patterns: [
                            Place.sequence_nearShore(BrontosaurusRule.get(), [0.4, 0.4]),
                            Place.scatter_nearShore(WaterGrassRule.get(), [1.5, 3.0])
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
                        length: [150, 400], patterns: [
                            Place.scatter_path(BottleRule.get(), [0.25, 0.5])
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
