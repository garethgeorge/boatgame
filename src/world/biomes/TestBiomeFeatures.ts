import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { BoatPathLayoutConfig } from '../layout/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { Combine, Select, Signal, TierRule } from '../decorators/DecorationRuleBuilders';
import { RiverSystem } from '../RiverSystem';
import { RiverGeometry } from '../RiverGeometry';
import { TerrainDecorator } from '../decorators/TerrainDecorator';
import { Decorations } from '../decorations/Decorations';
import { AnimalSpawner } from '../../entities/spawners/AnimalSpawner';
import { GingerMan, Monkey } from '../../entities/obstacles';
import { Fitness, PropParams } from '../decorations/SceneryRules';
import { DecorationConfig } from './DecorationConfig';
import { AlligatorRule, BrontosaurusRule, BrownBearRule, GingerManRule, MonkeyRule, MooseRule, PolarBearRule, TRexRule, TriceratopsRule, TurtleRule } from '../../entities/AnimalLayoutRules';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { Placements } from '../layout/BoatPathLayoutPatterns';
import { VignetteLayoutRules } from '../../entities/VignetteLayoutRules';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, TestBiomeFeatures.LENGTH, direction);
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.2 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    public createDecorationConfig(): DecorationConfig {
        const rules = [
            new TierRule({
                species: [
                    // {
                    //     id: 'chair',
                    //     preference: Fitness.make({
                    //         stepDistance: [5, 20],
                    //         slope: [0, 10],
                    //         stepNoise: { scale: 20, threshold: 0.7 }
                    //     }),
                    //     params: Select.choose([
                    //         PropParams.beach_chair(),
                    //         // PropParams.umbrella_with_chairs(1),
                    //         // PropParams.umbrella_with_chairs(2)
                    //     ])
                    // }
                ]
            }),
        ];

        return { rules };
    }

    public createLayoutConfig(): BoatPathLayoutConfig {
        return {
            tracks: [{
                name: 'unique_elements',
                placements: [
                    {
                        name: 'berg', at: 0.05,
                        placement: Placements.scatter({
                            entity: VignetteLayoutRules.icebergWalrus()
                        })
                    }
                ]
            },
            {
                name: 'animals',
                stages: [{
                    name: 'animals',
                    progress: [0.0, 1.0],
                    scenes: [{
                        length: [100, 300],
                        patterns: [
                            // Place.scatter_onShore(AlligatorRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(BrontosaurusRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(BrownBearRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(GingerManRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(MonkeyRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(MooseRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(PolarBearRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(TRexRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(TriceratopsRule.get(), [0.5, 0.5]),
                            // Place.scatter_onShore(TurtleRule.get(), [0.5, 0.5]),
                        ]
                    }]
                }]
            }],
            path: {
                length: [200, 100]
            }
        };
    }

    * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* super.populate(context, difficulty, zStart, zEnd);
        return;
    }
}
