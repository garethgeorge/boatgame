import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, PatternConfigs, TrackConfig } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { TerrainDecorator, DecorationRule, PlacementManifest } from '../decorators/TerrainDecorator';
import { Combine, Signal, TierRule } from '../decorators/PoissonDecorationRules';
import { SpatialGrid } from '../../managers/SpatialGrid';

/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Uses Context-Aware Archetypes for procedural placement.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';

    getGroundColor(): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    protected skyTopColors: number[] = [0x303948, 0xf6b581, 0x01cad1]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x5b6831, 0xf7efbc, 0xb0ece6]; // [Night, Sunset, Noon]

    public getBiomeLength(): number {
        return 1500;
    }

    public override getAmplitudeMultiplier(): number {
        return 0.5;
    }

    private decorationRules: DecorationRule[] = [
        new TierRule({
            species: [
                {
                    id: 'willow_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.step(Signal.noise2D(500.0, 250.0, 0.2, 0.3), 0.6),
                        Signal.inRange(Signal.distanceToRiver, 5, 25),
                        Signal.inRange(Signal.elevation, 1.0, 5.0),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 2 * scale,
                            canopyRadius: 5 * scale,
                            options: { kind: 'willow', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
                {
                    id: 'oak_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.linearRange(Signal.distanceToRiver, 20, 50),
                        Signal.inRange(Signal.elevation, 3.0, 20.0),
                        Signal.inRange(Signal.slope, 0, 50)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 1.5 * scale,
                            canopyRadius: 5.0 * scale,
                            options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                }
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'poplar',
                    preference: Combine.all(
                        Signal.step(Signal.noise2D(500.0, 250.0, 0.5, 0.1), 0.7),
                        Signal.inRange(Signal.distanceToRiver, 20, 40),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.7 + ctx.random() * 0.6;
                        return {
                            groundRadius: 0.5 * scale,
                            canopyRadius: 1.5 * scale,
                            spacing: 2 * scale,
                            options: { kind: 'poplar', rotation: ctx.random() * Math.PI * 2, scale }
                        }
                    }
                },
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'rock',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.inRange(Signal.distanceToRiver, 3, 20),
                        Signal.inRange(Signal.elevation, 6.0),
                        Signal.inRange(Signal.slope, 50)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.8;
                        return {
                            groundRadius: 5.0 * scale,
                            spacing: 10.0 * scale,
                            options: { kind: 'rock', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'flower',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.inRange(Signal.distanceToRiver, 5, 25),
                        Signal.inRange(Signal.elevation, 1.0, 5.0),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 1.0 * scale,
                            options: { kind: 'flower', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
            ]
        })
    ];

    public createLayout(zMin: number, zMax: number): BoatPathLayout {
        const waterAnimals = [EntityIds.DOLPHIN, EntityIds.SWAN];
        const patterns: PatternConfigs = {
            'dolphin_pods': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.5, 1.0],
                types: [EntityIds.DOLPHIN]
            },
            'swan_bevies': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.5, 1.0],
                types: [EntityIds.SWAN]
            },
            'butterfly_swarms': {
                logic: 'scatter',
                place: 'shore',
                density: [1.5, 3.0],
                types: [EntityIds.BUTTERFLY]
            },
            'bluebird_flocks': {
                logic: 'scatter',
                place: 'shore',
                density: [1.5, 3.0],
                types: [EntityIds.BLUEBIRD]
            }
        };

        const riverTrack: TrackConfig = {
            name: 'animals',
            stages: [
                {
                    name: 'river_animals',
                    progress: [0, 1.0],
                    patterns: [
                        [
                            { pattern: 'dolphin_pods', weight: 1.0 }
                        ],
                        [
                            { pattern: 'swan_bevies', weight: 1.0 }
                        ]
                    ]
                }
            ]
        };

        const randomChoice = Math.random();
        let flyingAnimalTrack: TrackConfig;

        if (randomChoice < 0.5) {
            flyingAnimalTrack = {
                name: 'butterflies',
                stages: [
                    {
                        name: 'butterfly_meadows',
                        progress: [0, 1.0],
                        patterns: [
                            [
                                { pattern: 'butterfly_swarms', weight: 1.0 }
                            ]
                        ]
                    }
                ]
            };
        } else {
            flyingAnimalTrack = {
                name: 'bluebirds',
                stages: [
                    {
                        name: 'bluebird_skies',
                        progress: [0, 1.0],
                        patterns: [
                            [
                                { pattern: 'bluebird_flocks', weight: 1.0 }
                            ]
                        ]
                    }
                ]
            };
        }

        const boatPath = BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: patterns,
            tracks: [
                riverTrack, flyingAnimalTrack
            ],
            waterAnimals
        });

        return boatPath;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const spatialGrid = context.chunk.spatialGrid;
        TerrainDecorator.decorate(
            context,
            this.decorationRules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 // Fixed seed for now
        );
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await BoatPathLayoutSpawner.getInstance().spawn(context, context.biomeLayout, this.id, zStart, zEnd);
    }
}
