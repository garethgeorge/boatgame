import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { TerrainDecorator } from '../decorators/TerrainDecorator';
import { FOREST_DECORATION_RULES } from './decorations/ForestDecorationRules';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';

    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 };
    }

    protected skyTopColors: number[] = [0x0b1517, 0x455d96, 0x0067b6]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x2b4f68, 0xede6da, 0xb1daec]; // [Night, Sunset, Noon]

    public override getAmplitudeMultiplier(): number {
        return 1.0;
    }

    private decorationRules = FOREST_DECORATION_RULES;

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
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

        return this.layoutCache;
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void, void, unknown> {
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            this.decorationRules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 + zStart // Seed variation
        );
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd);
    }
}
