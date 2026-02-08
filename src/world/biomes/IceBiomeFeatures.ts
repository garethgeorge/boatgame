import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { PopulationContext } from './PopulationContext';
import { BoatPathLayoutConfig, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { DecorationConfig, DecorationRule } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { Fitness, RockParams, TreeParams } from '../decorations/DecorationRules';
import { SkyBiome } from './BiomeFeatures';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { PolarBearRule, PenguinKayakRule } from '../../entities/AnimalEntityRules';
import { IcebergRule, BuoyRule, BottleRule } from '../../entities/StaticEntityRules';

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

    private decorationConfig: DecorationConfig | null = null;

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

    protected getLayoutConfig(): BoatPathLayoutConfig {
        const tracks: TrackConfig[] = [{
            name: 'obstacles',
            stages: [{
                name: 'ice_gauntlet',
                progress: [0, 1.0],
                scenes: [{
                    length: [100, 200], patterns: [
                        Place.scatter_slalom(IcebergRule.get(), [1.0, 3.0]),
                        Place.scatter_middle(BuoyRule.get(), [0.5, 1.5])
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

        return {
            tracks,
            path: {
                length: [200, 100]
            }
        };
    }

}
