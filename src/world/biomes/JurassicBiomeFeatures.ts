import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, PatternConfigs } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, JurassicBiomeFeatures.LENGTH, direction);
    }

    private decorationRules: DecorationRule[] | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x2E / 255, g: 0x4B / 255, b: 0x2E / 255 };
    }

    getFogDensity(): number {
        return 0.3;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 50, far: 600 };
    }

    protected skyTopColors: number[] = [0x101510, 0x667755, 0x88aa88]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x151A15, 0x889977, 0xaabb99]; // [Night, Sunset, Noon]

    getRiverWidthMultiplier(): number {
        return 1.7;
    }

    public getDecorationRules(): DecorationRule[] {
        if (!this.decorationRules) {
            this.decorationRules = [
                new TierRule({
                    species: [
                        {
                            id: 'cycad',
                            preference: SpeciesRules.fitness({
                                stepNoise: { scale: 300, threshold: 0.5 },
                                stepDistance: [5, 60],
                                slope: [0, 30]
                            }),
                            params: SpeciesRules.cycad()
                        },
                        {
                            id: 'tree_fern',
                            preference: SpeciesRules.fitness({
                                stepNoise: { scale: 300, threshold: 0.6 },
                                stepDistance: [10, 50],
                                slope: [0, 25]
                            }),
                            params: SpeciesRules.tree_fern()
                        },
                        {
                            id: 'rock',
                            preference: SpeciesRules.fitness({
                                fitness: 0.5,
                                stepDistance: [3, 40],
                                slope: [30, 90]
                            }),
                            params: SpeciesRules.rock({ rockBiome: this.id })
                        }
                    ]
                })
            ];
        }
        return this.decorationRules;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const patterns: PatternConfigs = {
            'scattered_rocks': {
                logic: 'scatter',
                place: 'slalom',
                density: [1.0, 3.0],
                types: [EntityIds.ROCK]
            },
            'staggered_logs': {
                logic: 'staggered',
                place: 'slalom',
                density: [0.5, 1.5],
                types: [EntityIds.LOG],
                minCount: 4
            },
            'dino_scatter': {
                logic: 'scatter',
                place: 'near-shore',
                density: [0.5, 1.5],
                types: [EntityIds.TREX, EntityIds.TRICERATOPS]
            },
            'ptero_scatter': {
                logic: 'scatter',
                place: 'on-shore',
                density: [0.5, 1.5],
                types: [EntityIds.PTERODACTYL]
            },
            'bronto_migration': {
                logic: 'sequence',
                place: 'near-shore',
                density: [0.4, 0.4],
                types: [EntityIds.BRONTOSAURUS]
            },
            'bottle_hunt': {
                logic: 'scatter',
                place: 'path',
                density: [0.25, 0.5],
                types: [EntityIds.BOTTLE]
            },
            'grass_patches': {
                logic: 'scatter',
                place: 'near-shore',
                density: [1.5, 3.0],
                types: [EntityIds.WATER_GRASS]
            }
        };

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: [
                {
                    name: 'obstacles',
                    stages: [
                        {
                            name: 'danger_zone',
                            progress: [0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'scattered_rocks', weight: 1.0 },
                                    { pattern: 'staggered_logs', weight: 0.5 },
                                    { pattern: 'grass_patches', weight: 1.5 }
                                ],
                                [
                                    { pattern: 'dino_scatter', weight: 1.0 },
                                    { pattern: 'bronto_migration', weight: 0.4 }
                                ],
                                [
                                    { pattern: 'ptero_scatter', weight: 1.0 }
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'collectables',
                    stages: [
                        {
                            name: 'bottles',
                            progress: [0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'bottle_hunt', weight: 1.0 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.BRONTOSAURUS]
        });

        return this.layoutCache;
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const decorationRules = this.getDecorationRules();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationRules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            42 // Use a specific seed
        );
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
