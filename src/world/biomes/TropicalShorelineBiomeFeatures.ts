import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { BoatPathLayoutConfig, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { DecorationConfig } from '../decorators/TerrainDecorator';
import { Select, Signal, TierRule } from '../decorators/DecorationRuleBuilders';
import { Fitness, PropParams, RockParams, TreeParams } from '../decorations/SceneryRules';
import { RiverSystem } from '../RiverSystem';
import { SimplexNoise } from '../../core/SimplexNoise';
import { CoreMath } from '../../core/CoreMath';
import { SkyBiome } from './BiomeFeatures';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { DolphinRule, TurtleRule, ButterflyRule, ParrotRule } from '../../entities/AnimalLayoutRules';
import { BirdOnBeachChairRule } from '../../entities/VignetteLayoutRules';
import { DecorationRule, WorldContext } from '../decorators/DecorationRule';

/**
 * Tropical Shoreline Biome: A sunny coastal paradise with palm trees and marine life.
 */
export class TropicalShorelineBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'tropical_shoreline';
    private static readonly LENGTH = 1200;

    private decorationConfig: DecorationConfig | null = null;

    private colorNoise = new SimplexNoise(42);
    private readonly SAND_COLOR = new THREE.Color(0xf2d16b);
    private readonly GRASS_COLOR = new THREE.Color(0x33aa33);

    constructor(index: number, z: number, direction: number) {
        super(index, z, TropicalShorelineBiomeFeatures.LENGTH, direction);
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x00bfff, bottom: 0x7fffd4 },
            sunset: { top: 0x483d8b, mid: 0xff1493, bottom: 0xffa07a },
            night: { top: 0x010b1a, bottom: 0x004466 },
            haze: 0.6
        };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 1.0, g: 0.98, b: 0.9 };
    }

    public override getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        const banks = RiverSystem.getInstance().getBankPositions(z);
        const distToShore = x < banks.center ? banks.left - x : x - banks.right;
        const t = this.getBeachFactor(z, distToShore);

        // Mix the colors
        const color = this.SAND_COLOR.clone().lerp(this.GRASS_COLOR, t);
        return { r: color.r, g: color.g, b: color.b };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        const t = this.getBeachFactor(wz, distFromBank);

        const m = 0.1 + 0.3 * t;
        return m * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    private getBeachFactor(z: number, distToShore: number): number {
        // Noise varies from -1 to 1, we normalize to [0, 1]
        // Scale z by 0.05 for a smooth variation along the shoreline
        const noiseVal = (this.colorNoise.noise2D(z * 0.01, 0) + 1) / 2;

        // Transition distance varies
        const transitionDist = 20 + noiseVal * 30;

        // Calculate interpolation factor using smoothstep for a natural look
        const t = CoreMath.smoothstep(transitionDist * 0.75, transitionDist, distToShore);

        return t;
    }

    private shorelineRules(): DecorationRule[] {
        return [
            new TierRule({
                species: [
                    {
                        id: 'palm',
                        preference: Fitness.make({
                            stepDistance: [5, 60],
                            slope: [0, 20]
                        }),
                        params: TreeParams.palm()
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        // This exists only to make chairs for Parrot perches
                        id: 'parrot-chair',
                        preference: Signal.constant(0),
                        params: Select.choose([
                            PropParams.beach_chair(),
                        ])
                    },
                    {
                        id: 'chair',
                        preference: Fitness.make({
                            stepDistance: [5, 20],
                            slope: [0, 10],
                            stepNoise: { scale: 20, threshold: 0.7 }
                        }),
                        params: Select.choose([
                            PropParams.beach_chair(),
                            PropParams.umbrella_with_chairs(1),
                            PropParams.umbrella_with_chairs(2)
                        ])
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: Fitness.make({
                            stepDistance: [0, 15],
                            slope: [10, 60],
                            fitness: 0.5
                        }),
                        params: RockParams.rock()
                    }
                ]
            })
        ];
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            this.decorationConfig = { rules: this.shorelineRules(), maps: {} };
        }
        return this.decorationConfig;
    }

    protected getLayoutConfig(): BoatPathLayoutConfig {
        return {
            tracks: [{
                name: 'river',
                stages: [{
                    name: 'dolphins',
                    progress: [0.0, 1.0],
                    scenes: [{ length: [100, 300], patterns: [Place.scatter_slalom(DolphinRule.get(), [0.4, 0.7])] }]
                }]
            },
            {
                name: 'near-shore',
                stages: [{
                    name: 'turtles',
                    progress: [0.0, 1.0],
                    scenes: [{ length: [100, 300], patterns: [Place.scatter_nearShore(TurtleRule.get(), [0.3, 0.6])] }]
                }]
            },
            {
                name: 'flying',
                stages: [{
                    name: 'flying_animals',
                    progress: [0.4, 1.0],
                    scenes: [{
                        length: [100, 300],
                        patterns: [
                            Place.scatter_onShore(ButterflyRule.get(), [0.3, 0.6]),
                            // Parrots need a chair to perch on
                            Place.scatter_onShore(
                                ParrotRule.get('parrot-chair', PropParams.beach_chair_slot),
                                [0.4, 0.8]
                            )
                        ]
                    }]
                }]
            }
            ],
            path: {
                length: [200, 100]
            }
        };
    }

}
