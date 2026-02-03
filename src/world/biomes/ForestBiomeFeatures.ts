import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy } from './decorations/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { EntitySpawners } from '../../entities/EntitySpawners';
import { Decorations } from '../Decorations';
import { SkyBiome } from './BiomeFeatures';
import { Patterns } from './decorations/BoatPathLayoutPatterns';
import { EntityRules } from './decorations/EntityLayoutRules';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, ForestBiomeFeatures.LENGTH, direction);
    }

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

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: {
                'forest_slalom': Patterns.scatter({
                    place: 'slalom',
                    density: [1.0, 2.0],
                    entity: EntityRules.choose([EntityRules.log(), EntityRules.rock(), EntityRules.buoy()])
                }),
                'rock_gates': Patterns.gate({
                    place: 'slalom',
                    density: [1.0, 2.0],
                    entity: EntityRules.choose([EntityRules.rock()]),
                    minCount: 2
                }),
                'piers': Patterns.staggered({
                    place: 'slalom',
                    density: [0.3, 0.9],
                    entity: EntityRules.choose([EntityRules.pier()]),
                    minCount: 2
                }),
                'forest_animals': Patterns.scatter({
                    place: 'near-shore',
                    density: [0.8, 2.5],
                    entity: EntityRules.choose([EntityRules.brown_bear(), EntityRules.moose()])
                }),
                'duckling_train': Patterns.sequence({
                    place: 'path',
                    density: [0.5, 1.5],
                    entity: EntityRules.choose([EntityRules.duckling()]),
                    minCount: 3
                }),
                'grass_patches': Patterns.scatter({
                    place: 'near-shore',
                    density: [1.0, 2.0],
                    entity: EntityRules.choose([EntityRules.water_grass()])
                })
            },
            tracks: [
                {
                    name: 'obstacles',
                    stages: [
                        {
                            name: 'forest_mix',
                            progress: [0, 1.0],
                            scenes: [
                                { length: [100, 200], patterns: ['forest_slalom', 'forest_animals'] },
                                { length: [100, 200], patterns: ['rock_gates', 'forest_animals'] },
                                { length: [100, 200], patterns: ['grass_patches', 'forest_animals'] },
                                { length: [100, 200], patterns: ['piers', 'forest_animals'] }
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
                                { length: [100, 300], patterns: ['duckling_train'] }
                            ]
                        }
                    ]
                }
            ],
            path: {
                length: [200, 100]
            }
        });

        return this.layoutCache;
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            this.decorationConfig,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 + zStart // Seed variation
        );
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
