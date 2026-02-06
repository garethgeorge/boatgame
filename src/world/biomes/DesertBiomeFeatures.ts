import { PopulationContext } from './PopulationContext';
import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { BoatPathLayout, BoatPathLayoutConfig, BoatPathLayoutStrategy, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { BoatPathLayoutSpawner } from '../layout/BoatPathLayoutSpawner';
import { DecorationConfig, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { DecoRules } from '../decorations/DecoRules';
import { SkyBiome } from './BiomeFeatures';
import { Placements, Patterns } from '../layout/BoatPathLayoutPatterns';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { EntityRules } from '../layout/EntityLayoutRules';
import { AlligatorRule, MonkeyRule, HippoRule } from '../../entities/AnimalEntityRules';
import { BottleRule, RockRule, PierRule } from '../../entities/StaticEntityRules';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, DesertBiomeFeatures.LENGTH, direction);
    }

    private spatialGrid: SpatialGrid = new SpatialGrid(20);
    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

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
                            preference: DecoRules.fitness({
                                fitness: 0.2,
                                stepDistance: [5, 100],
                                slope: [0, 30]
                            }),
                            params: DecoRules.cactus()
                        }
                    ]
                }),
                new TierRule({
                    species: [
                        {
                            id: 'rock',
                            preference: DecoRules.fitness({
                                fitness: 0.1,
                                stepDistance: [3, 20],
                                slope: [0, 70]
                            }),
                            params: DecoRules.rock({ rockBiome: 'desert' })
                        }
                    ]
                })
            ];

            this.decorationConfig = { rules, maps: {} };
        }
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const tracks: TrackConfig[] = [
            {
                name: 'main',
                stages: [{
                    name: 'intro',
                    progress: [0, 0.4], scenes: [{
                        length: [50, 100], patterns: [
                            Place.sequence_slalom(RockRule.get('desert'), [0.5, 2.0])
                        ]
                    },
                    {
                        length: [50, 100], patterns: [
                            Place.staggered_slalom(RockRule.get('desert'), [0.5, 2.0], { minCount: 3 })
                        ]
                    }]
                },
                {
                    name: 'gauntlet',
                    progress: [0.3, 0.9], scenes: [{
                        length: [100, 200], patterns: [
                            Place.sequence_nearShore([AlligatorRule.get(), MonkeyRule.get()], [0.5, 4.0]),
                            Place.sequence_slalom(RockRule.get('desert'), [0.5, 2.0])
                        ]
                    },
                    {
                        length: [100, 200], patterns: [
                            Place.cluster_nearShore(HippoRule.get(), [0.3, 2.0], { minCount: 2 }),
                            Place.staggered_slalom(RockRule.get('desert'), [0.5, 2.0], { minCount: 3 })
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

    * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // 1. Get entity layout creating it if needed
        const layout = this.getLayout();

        // 2. Decorate
        const config = this.getDecorationConfig();

        // decorations are inserted into the chunk grid but checked for
        // collisions against the layout grid for the entire biome
        const spatialGrid = new SpatialGridPair(
            context.chunk.spatialGrid,
            this.spatialGrid
        );

        yield* TerrainDecorator.decorateIterator(
            context,
            config,
            { xMin: -240, xMax: 240, zMin: zStart, zMax: zEnd },
            spatialGrid,
            42 // Desert seed
        );

        // 3. Spawn
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }

}
