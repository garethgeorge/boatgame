import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { BoatPathLayoutConfig, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/DecorationRuleBuilders';
import { Fitness, TreeParams, FlowerParams } from '../decorations/SceneryRules';
import { SkyBiome } from './BiomeFeatures';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { DragonflyRule } from '../../entities/AnimalLayoutRules';


/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Uses Context-Aware Archetypes for procedural placement.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';
    private static readonly LENGTH = 600;

    constructor(index: number, z: number, direction: number) {
        super(index, z, HappyBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x00ccff, bottom: 0xffffff },
            sunset: { top: 0x4b0082, mid: 0xff69b4, bottom: 0xf0e68c },
            night: { top: 0x0a1a33, bottom: 0x334466 },
            haze: 0.4
        };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.5 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    public getDecorationConfig(): DecorationConfig {
        if (this.decorationConfig) return this.decorationConfig;

        const rules: TierRule[] = [];

        {
            const r = Math.random();
            rules.push(new TierRule({
                species: [
                    {
                        id: 'trees',
                        preference: Fitness.make({
                            fitness: 0.02,
                            stepDistance: [5, 100]
                        }),
                        params: r < 0.5 ?
                            TreeParams.box_elder({ size: 3 }) :
                            TreeParams.elm()
                    }
                ]
            }));
        }
        {
            const r = Math.random();
            rules.push(new TierRule({
                species: [
                    {
                        id: 'lilies',
                        preference: Fitness.make({
                            fitness: 1,
                            stepDistance: [5, 20],
                            stepNoise: { scale: 50, threshold: 0.7 }
                        }),
                        params: r < 0.5 ?
                            FlowerParams.lily() :
                            FlowerParams.daisy()
                    }
                ]
            }));
        }

        this.decorationConfig = { rules: rules, maps: {} };
        return this.decorationConfig;
    }

    protected getLayoutConfig(): BoatPathLayoutConfig {
        const tracks: TrackConfig[] = [{
            name: 'flying',
            stages: [{
                name: 'flying_animals',
                progress: [0.4, 1.0],
                scenes: [{ length: [200, 400], patterns: [Place.scatter_path(DragonflyRule.get(), [0.3, 0.6])] }]
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
