import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { TerrainDecorator, DecorationRule } from '../decorators/TerrainDecorator';
import { Combine, Signal, SpeciesHelpers, TierRule } from '../decorators/PoissonDecorationRules';
import { SpatialGrid } from '../../managers/SpatialGrid';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 };
    }

    protected skyTopColors: number[] = [0x0b1517, 0x455d96, 0x0067b6]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x2b4f68, 0xede6da, 0xb1daec]; // [Night, Sunset, Noon]

    public getBiomeLength(): number {
        return 2000;
    }

    public override getAmplitudeMultiplier(): number {
        return 1.0;
    }

    private decorationRules: DecorationRule[] = [
        new TierRule({
            species: [
                {
                    id: 'elder_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        // Only spawn far from river
                        Signal.stepLinear(Signal.distanceToRiver, 60, 70),
                        // Rare spawn chance (5%) implemented via noise gating
                        Signal.step(Signal.noise2D(123.4, 123.4), 0.95)
                    ),
                    params: (ctx) => {
                        const scale = 2.0 + ctx.random() * 0.5; // Large scale
                        return {
                            groundRadius: 1.0 * scale,
                            canopyRadius: 5.0 * scale,
                            speciesRadius: 25.0 * scale,
                            options: { kind: 'elder', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
                {
                    id: 'birch_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        // Use organic perlin noise clumps instead of sine stripes
                        Signal.step(Signal.noise2D(0.02, 0.02), 0.5),
                        // Avoid river
                        Signal.inRange(Signal.distanceToRiver, 5, 200)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 1.2 * scale,
                            canopyRadius: 4.0 * scale,
                            speciesRadius: SpeciesHelpers.attenuate(ctx, 4.0 * scale),
                            options: { kind: 'birch', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
                {
                    id: 'oak_tree',
                    preference: Combine.all(
                        Signal.constant(0.9), // 0.9 allows Birch (1.0) to win in its clumps, but Oak wins otherwise
                        Signal.inRange(Signal.distanceToRiver, 5, 200)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 1.5 * scale,
                            canopyRadius: 5.0 * scale,
                            speciesRadius: SpeciesHelpers.attenuate(ctx, 5.0 * scale),
                            options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                }
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'rock',
                    preference: Combine.all(
                        Signal.constant(0.2), // Low probability everywhere
                        // Higher prob near shore?
                        Signal.max(
                            Signal.constant(0.1),
                            Signal.inRange(Signal.distanceToRiver, 2, 10) // Shore rocks
                        )
                    ),
                    params: (ctx) => {
                        const scale = 0.7 + ctx.random() * 0.8;
                        return {
                            groundRadius: 2.5 * scale,
                            speciesRadius: 5.0 * scale,
                            options: { kind: 'rock', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                }
            ]
        })
    ];

    public createLayout(zMin: number, zMax: number): BoatPathLayout {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'forest_slalom': {
                    logic: 'scatter',
                    place: 'slalom',
                    density: [1.0, 2.0],
                    types: [EntityIds.LOG, EntityIds.ROCK, EntityIds.BUOY]
                },
                'rock_gates': {
                    logic: 'gate',
                    place: 'slalom',
                    density: [1.0, 2.0],
                    types: [EntityIds.ROCK],
                    minCount: 2
                },
                'piers': {
                    logic: 'staggered',
                    place: 'slalom',
                    density: [0.3, 0.9],
                    types: [EntityIds.PIER],
                    minCount: 2
                },
                'forest_animals': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [0.8, 2.5],
                    types: [EntityIds.BROWN_BEAR, EntityIds.MOOSE]
                },
                'duckling_train': {
                    logic: 'sequence',
                    place: 'path',
                    density: [0.5, 1.5],
                    types: [EntityIds.DUCKLING],
                    minCount: 3
                },
                'grass_patches': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [1.0, 2.0],
                    types: [EntityIds.WATER_GRASS]
                }
            },
            tracks: [
                {
                    name: 'obstacles',
                    stages: [
                        {
                            name: 'forest_mix',
                            progress: [0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'forest_slalom', weight: 1.0 },
                                    { pattern: 'rock_gates', weight: 0.5 },
                                    { pattern: 'piers', weight: 0.3 },
                                    { pattern: 'grass_patches', weight: 1.0 }
                                ],
                                [
                                    { pattern: 'forest_animals', weight: 1.0 }
                                ]
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
                            patterns: [
                                [
                                    { pattern: 'duckling_train', weight: 1.0 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.DUCKLING]
        });
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const spatialGrid = context.chunk.spatialGrid;
        TerrainDecorator.decorate(
            context,
            this.decorationRules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 + zStart // Seed variation
        );
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await BoatPathLayoutSpawner.getInstance().spawn(context, context.biomeLayout, this.id, zStart, zEnd);
    }
}
