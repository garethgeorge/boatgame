import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, Patterns } from './decorations/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { DecorationConfig, DecorationRule, NoiseMap, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { WorldMap } from '../decorators/PoissonDecorationStrategy';
import { SimplexNoise } from '../SimplexNoise';
import { SkyBiome } from './BiomeFeatures';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, JurassicBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

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

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            const maps = {
                trees: new NoiseMap(new SimplexNoise(), 300, 300)
            };

            const rules = [
                new TierRule({
                    species: [
                        {
                            id: 'cycad',
                            preference: SpeciesRules.fitness({
                                map: { name: 'trees', range: [0, 0.5] },
                                stepDistance: [5, 100],
                                slope: [0, 30]
                            }),
                            params: SpeciesRules.cycad()
                        },
                        {
                            id: 'tree_fern',
                            preference: SpeciesRules.fitness({
                                map: { name: 'trees', range: [0.5, 1] },
                                stepDistance: [10, 100],
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

            this.decorationConfig = { maps, rules };
        }
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const patterns = {
            'scattered_rocks': Patterns.scatter({
                place: 'slalom',
                density: [1.0, 3.0],
                types: [EntityIds.ROCK]
            }),
            'staggered_logs': Patterns.staggered({
                place: 'slalom',
                density: [0.5, 1.5],
                types: [EntityIds.LOG],
                minCount: 4
            }),
            'dino_scatter': Patterns.scatter({
                place: 'near-shore',
                density: [0.5, 1.5],
                types: [EntityIds.TREX, EntityIds.TRICERATOPS]
            }),
            'ptero_scatter': Patterns.scatter({
                place: 'on-shore',
                density: [0.5, 1.5],
                types: [EntityIds.PTERODACTYL]
            }),
            'bronto_migration': Patterns.sequence({
                place: 'near-shore',
                density: [0.4, 0.4],
                types: [EntityIds.BRONTOSAURUS]
            }),
            'bottle_hunt': Patterns.scatter({
                place: 'path',
                density: [0.25, 0.5],
                types: [EntityIds.BOTTLE]
            }),
            'grass_patches': Patterns.scatter({
                place: 'near-shore',
                density: [1.5, 3.0],
                types: [EntityIds.WATER_GRASS]
            })
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
                            scenes: [
                                { length: [100, 200], patterns: ['scattered_rocks', 'dino_scatter', 'grass_patches'] },
                                { length: [100, 200], patterns: ['staggered_logs', 'ptero_scatter'] },
                                { length: [100, 200], patterns: ['bronto_migration', 'grass_patches'] }
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
                            scenes: [
                                { length: [150, 400], patterns: ['bottle_hunt'] }
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.BRONTOSAURUS],
            path: {
                length: [200, 100]
            }
        });

        return this.layoutCache;
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const decorationConfig = this.getDecorationConfig();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationConfig,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            42 // Use a specific seed
        );
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
