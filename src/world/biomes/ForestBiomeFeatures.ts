import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { BoatPathLayout, BoatPathLayoutConfig, BoatPathLayoutStrategy } from './decorations/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { Decorations } from '../Decorations';
import { SkyBiome } from './BiomeFeatures';
import { Placements, Patterns } from './decorations/BoatPathLayoutPatterns';
import { EntityRules } from './decorations/EntityLayoutRules';
import { AnimalEntityRules } from '../../entities/AnimalEntityRules';
import { StaticEntityRules } from '../../entities/StaticEntityRules';
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
                        preference: SpeciesRules.fitness({
                            stepDistance: [60, 70],
                            stepNoise: { scale: 123.4, threshold: 0.95 }
                        }),
                        params: SpeciesRules.elder_tree({ paletteName: 'fall_yellow' })
                    },
                    {
                        id: 'birch_tree',
                        preference: SpeciesRules.fitness({
                            stepNoise: { scale: 50, threshold: 0.5 },
                            stepDistance: [5, 200]
                        }),
                        params: SpeciesRules.birch_tree({ paletteName: 'fall_yellow' })
                    },
                    {
                        id: 'oak_tree',
                        preference: SpeciesRules.fitness({
                            fitness: 0.9,
                            stepDistance: [5, 200]
                        }),
                        params: SpeciesRules.oak_tree({ paletteName: 'fall_red_orange' })
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: SpeciesRules.fitness({
                            fitness: 0.2, minFitness: 0.02, stepDistance: [2, 10]
                        }),
                        params: SpeciesRules.rock()
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

        const config: BoatPathLayoutConfig = {
            patterns: {
                'nothing': Patterns.none(),
                'log_slalom': Patterns.scatter({
                    placement: Placements.slalom({
                        entity: EntityRules.choose([StaticEntityRules.log()])
                    }),
                    density: [3.0, 3.0],
                }),
                'rock_gates': Patterns.gate({
                    placement: Placements.slalom({
                        entity: EntityRules.choose([StaticEntityRules.rock('forest')])
                    }),
                    density: [2.0, 2.0],
                    minCount: 2
                }),
                'piers': Patterns.staggered({
                    placement: Placements.atShore({
                        entity: EntityRules.choose([StaticEntityRules.pier()])
                    }),
                    density: [0.001, 0.001],    // low density means 2 per segment
                    minCount: 2
                }),
                'grass_patches': Patterns.scatter({
                    placement: Placements.nearShore({
                        entity: EntityRules.choose([StaticEntityRules.water_grass()])
                    }),
                    density: [2.0, 2.0],
                }),
                'moose': Patterns.cluster({
                    placement: Placements.nearShore({
                        entity: EntityRules.choose([AnimalEntityRules.moose()])
                    }),
                    density: [0.3, 3.0],
                }),
                'bear': Patterns.cluster({
                    placement: Placements.nearShore({
                        entity: EntityRules.choose([AnimalEntityRules.brown_bear()])
                    }),
                    density: [0.3, 3.0],
                }),
                'duckling_train': Patterns.cluster({
                    placement: Placements.path({
                        entity: EntityRules.choose([AnimalEntityRules.duckling()])
                    }),
                    density: [0.5, 1.5],
                    minCount: 3
                }),
                'bottle_train': Patterns.cluster({
                    placement: Placements.path({
                        entity: EntityRules.choose([StaticEntityRules.bottle()])
                    }),
                    density: [0.5, 1.5],
                    minCount: 3
                }),
            },
            tracks: [
                {
                    name: 'obstacles',
                    stages: [
                        {
                            name: 'arrival', progress: [0, 0.2],
                            scenes: [
                                { length: [100, 150], patterns: ['log_slalom'] },
                                { length: [100, 150], patterns: ['rock_gates'] },
                            ]
                        },
                        {
                            name: 'grass+piers', progress: [0.2, 0.7],
                            scenes: [
                                { length: [60, 100], patterns: ['grass_patches'] },
                                { length: [200, 300], patterns: ['piers'] }
                            ]
                        }
                    ]
                },
                {
                    name: 'animals',
                    stages: [
                        {
                            name: 'forest_mix',
                            progress: [0.2, 0.8],
                            scenes: [
                                { length: [100, 200], patterns: ['moose'] },
                                { length: [100, 200], patterns: ['bear'] },
                            ]
                        }
                    ]
                },
                {
                    name: 'path_life',
                    stages: [
                        {
                            name: 'ducklings',
                            progress: [0.3, 1.0],
                            scenes: [
                                { length: [20, 50], patterns: ['duckling_train'] },
                                { length: [20, 50], patterns: ['bottle_train'] },
                                { length: [200, 300], patterns: ['nothing'] }
                            ]
                        }
                    ]
                }
            ],
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
