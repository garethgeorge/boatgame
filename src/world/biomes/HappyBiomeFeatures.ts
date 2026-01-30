import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, PatternConfigs, TrackConfig } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
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

    private decorationRules: DecorationRule[] | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    protected skyTopColors: number[] = [0x303948, 0xf6b581, 0x01cad1]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x5b6831, 0xf7efbc, 0xb0ece6]; // [Night, Sunset, Noon]

    public override getAmplitudeMultiplier(): number {
        return 0.5;
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
                            fitness: 1.0, linearDistance: [20, 50], elevation: [3, 20], slope: [0, 50]
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

    private getDecorationRules(): DecorationRule[] {
        if (!this.decorationRules) {
            if (Math.random() < 0.5) {
                this.decorationRules = this.parklandRules();
            } else {
                this.decorationRules = this.riverlandRules();
            }
        }
        return this.decorationRules;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const waterAnimals = [EntityIds.DOLPHIN, EntityIds.SWAN];
        const patterns: PatternConfigs = {
            'dolphin_pods': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.3, 0.6],
                types: [EntityIds.DOLPHIN]
            },
            'swan_bevies': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.3, 0.6],
                types: [EntityIds.SWAN]
            },
            'turtle_hurds': {
                logic: 'scatter',
                place: 'near-shore',
                density: [0.3, 0.6],
                types: [EntityIds.TURTLE]
            },
            'butterfly_swarms': {
                logic: 'scatter',
                place: 'on-shore',
                density: [0.3, 0.6],
                types: [EntityIds.BUTTERFLY]
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
            { river: 'dolphin_pods', flying: 'bluebird_flocks' },
            { river: 'swan_bevies', flying: 'butterfly_swarms' },
            { river: 'turtle_hurds', flying: 'dragonfly_swarms' },
        ];
        const combo = patternCombos[Math.abs(this.index) % 3];

        const riverTrack: TrackConfig = {
            name: 'river',
            stages: [
                {
                    name: 'river_animals',
                    progress: [0.2, 1.0],
                    patterns: [[{ pattern: combo.river, weight: 1.0 }]]
                }
            ]
        };

        const flyingTrack: TrackConfig = {
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
        };

        const shoreTrack: TrackConfig = {
            name: 'near-shore',
            stages: [
                {
                    name: 'shore_animals',
                    progress: [0.0, 1.0],
                    patterns: [
                        [
                            { pattern: 'unicorn_herd', weight: 1.0 }
                        ]
                    ]
                }
            ]
        };

        const boatPathLayout = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: [
                riverTrack, flyingTrack, shoreTrack
            ],
            waterAnimals
        });

        this.layoutCache = boatPathLayout;
        return this.layoutCache;
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const decorationRules = this.getDecorationRules();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationRules,
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
