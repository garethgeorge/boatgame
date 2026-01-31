import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, PatternConfigs, TrackConfig } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator, NoiseMap, DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule, Signal, Combine } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';


/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Uses Context-Aware Archetypes for procedural placement.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, HappyBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    protected skyTopColors: number[] = [0x303948, 0xf6b581, 0x01cad1]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x5b6831, 0xf7efbc, 0xb0ece6]; // [Night, Sunset, Noon]

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.5 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    private riverlandRules(): DecorationRule[] {
        const rules = [
            new TierRule({
                species: [
                    {
                        id: 'elm_tree',
                        preference: SpeciesRules.fitness({
                            stepNoise: { scale: 400, threshold: 0.5 },
                            stepDistance: [10, 60],
                            slope: [0, 25]
                        }),
                        params: SpeciesRules.elm_tree()
                    },
                    {
                        id: 'vase_tree',
                        preference: SpeciesRules.fitness({
                            fitness: 0.8,
                            stepDistance: [15, 50],
                            slope: [0, 20]
                        }),
                        params: SpeciesRules.box_elder()
                    },
                    {
                        id: 'open_tree',
                        preference: SpeciesRules.fitness({
                            fitness: 0.7,
                            stepDistance: [5, 40],
                            slope: [0, 30]
                        }),
                        params: SpeciesRules.japanese_maple()
                    },
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'daisy',
                        preference: SpeciesRules.fitness({
                            stepDistance: [2, 30],
                            slope: [0, 15],
                            stepNoise: { scale: 100, threshold: 0.7 }
                        }),
                        params: SpeciesRules.daisy()
                    },
                    {
                        id: 'lily',
                        preference: SpeciesRules.fitness({
                            stepDistance: [2, 30],
                            slope: [0, 15],
                            stepNoise: { scale: 100, threshold: 0.7 }
                        }),
                        params: SpeciesRules.lily()
                    }
                ]
            })
        ];
        return rules;
    }

    private parklandRules(): DecorationRule[] {
        const rules = [
            new TierRule({
                species: [
                    {
                        id: 'willow_tree',
                        preference: SpeciesRules.fitness({
                            stepNoise: { scale: [500, 250], threshold: 0.6 },
                            stepDistance: [5, 25],
                            elevation: [1.0, 5.0],
                            slope: [0, 15]
                        }),
                        params: SpeciesRules.willow_tree()
                    },
                    {
                        id: 'oak_tree',
                        preference: SpeciesRules.fitness({
                            fitness: 1.0, linearEaseIn: [20, 50], elevation: [3, 20], slope: [0, 50]
                        }),
                        params: SpeciesRules.oak_tree()
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'poplar',
                        preference: SpeciesRules.fitness({
                            stepNoise: { scale: [500, 250], threshold: 0.7 },
                            stepDistance: [20, 40],
                            slope: [0, 15]
                        }),
                        params: SpeciesRules.poplar_tree()
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: SpeciesRules.fitness({
                            stepDistance: [3, 20], elevation: [6, Infinity], slope: [50, Infinity]
                        }),
                        params: SpeciesRules.rock()
                    },
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'daisy',
                        preference: SpeciesRules.fitness({
                            stepDistance: [2, 30],
                            slope: [0, 15],
                            stepNoise: { scale: 100, threshold: 0.7 }
                        }),
                        params: SpeciesRules.daisy()
                    },
                    {
                        id: 'lily',
                        preference: SpeciesRules.fitness({
                            stepDistance: [2, 30],
                            slope: [0, 15],
                            stepNoise: { scale: 100, threshold: 0.7 }
                        }),
                        params: SpeciesRules.lily()
                    }
                ]
            })
        ];
        return rules;
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            if (Math.random() < 0.5) {
                this.decorationConfig = { rules: this.parklandRules(), maps: {} };
            } else {
                this.decorationConfig = { rules: this.riverlandRules(), maps: {} };
            }
        }
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const waterAnimals = [EntityIds.DOLPHIN, EntityIds.SWAN];
        const patterns: PatternConfigs = {
            'swan_bevies': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.3, 0.6],
                types: [EntityIds.SWAN]
            },
            'bluebird_flocks': {
                logic: 'scatter',
                place: 'on-shore',
                density: [0.3, 0.6],
                types: [EntityIds.BLUEBIRD]
            },
            'dragonfly_swarms': {
                logic: 'scatter',
                place: 'path',
                density: [0.3, 0.6],
                types: [EntityIds.DRAGONFLY]
            },
            'unicorn_herd': {
                logic: 'scatter',
                place: 'on-shore',
                density: [0.2, 0.4],
                types: [EntityIds.UNICORN]
            }
        };

        // Pick a combination by simple cycling through
        const patternCombos = [
            { river: 'swan_bevies', shore: 'unicorn_herd' },
            { river: 'turtle_hurds', flying: 'dragonfly_swarms' },
        ];
        const combo = patternCombos[Math.abs(this.index) % 3];

        let tracks: TrackConfig[] = [];

        if (combo.river !== undefined) {
            tracks.push({
                name: 'river',
                stages: [
                    {
                        name: 'river_animals',
                        progress: [0.2, 1.0],
                        patterns: [[{ pattern: combo.river, weight: 1.0 }]]
                    }
                ]
            });
        }

        if (combo.flying !== undefined) {
            tracks.push({
                name: 'flying',
                stages: [
                    {
                        name: 'flying_animals',
                        progress: [0.4, 1.0],
                        patterns: [
                            [
                                { pattern: combo.flying, weight: 1.0 }
                            ]
                        ]
                    }
                ]
            });
        }

        if (combo.shore !== undefined) {
            tracks.push({
                name: 'near-shore',
                stages: [
                    {
                        name: 'shore_animals',
                        progress: [0.0, 1.0],
                        patterns: [
                            [
                                { pattern: combo.shore, weight: 1.0 }
                            ]
                        ]
                    }
                ]
            });
        }

        const boatPathLayout = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: tracks,
            waterAnimals
        });

        this.layoutCache = boatPathLayout;
        return this.layoutCache;
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const decorationConfig = this.getDecorationConfig();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationConfig,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 // Fixed seed for now
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const layout = this.getLayout();
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
