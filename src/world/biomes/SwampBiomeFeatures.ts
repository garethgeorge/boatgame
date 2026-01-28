import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { EntitySpawners } from '../../entities/spawners/EntitySpawners';
import { Decorations } from '../Decorations';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { RiverGeometry } from '../RiverGeometry';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';
    private static readonly LENGTH = 1600;

    constructor(index: number, z: number, direction: number) {
        super(index, z, SwampBiomeFeatures.LENGTH, direction);
    }

    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x2B / 255, g: 0x24 / 255, b: 0x1C / 255 }; // Muddy Dark Brown
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xB0 / 255, g: 0xA0 / 255, b: 0xD0 / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 300 };
    }


    protected skyTopColors: number[] = [0xf5674c, 0xb99d95, 0xcfcff3]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0xf5674c, 0xf5674c, 0xbbc1f1]; // [Night, Sunset, Noon]

    getAmplitudeMultiplier(): number {
        return 0.1;
    }

    getRiverWidthMultiplier(): number {
        return 5.0;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: {
                'dense_shore_mangroves': {
                    logic: 'scatter',
                    place: 'near-shore',
                    density: [20, 40],
                    types: [EntityIds.MANGROVE],
                    minCount: 15
                },
                'clear_channel_bottles': {
                    logic: 'sequence',
                    place: 'path',
                    density: [0.5, 0.5],
                    types: [EntityIds.BOTTLE]
                },
                'log_scatter': {
                    logic: 'scatter',
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: [EntityIds.LOG]
                },
                'threat_ambush': {
                    logic: 'scatter',
                    place: 'path',
                    density: [0.2, 0.6],
                    types: [EntityIds.ALLIGATOR, EntityIds.SNAKE]
                },
                'egret_flight': {
                    logic: 'scatter',
                    place: 'path',
                    density: [1, 2],
                    types: [EntityIds.EGRET]
                },
                'dragonfly_buzz': {
                    logic: 'cluster',
                    place: 'path',
                    density: [0.5, 1],
                    minCount: 2.0,
                    maxCount: 3.0,
                    types: [EntityIds.DRAGONFLY]
                },
                'grass_patches': {
                    logic: 'scatter',
                    place: 'near-shore',
                    density: [1.5, 3.0],
                    types: [EntityIds.WATER_GRASS]
                },
                'lilly_patches': {
                    logic: 'scatter',
                    place: 'middle',
                    density: [5.0, 10.0],
                    minCount: 100,
                    types: [EntityIds.LILLY_PAD_PATCH]
                }
            },
            tracks: [
                {
                    name: 'vegetation',
                    stages: [
                        {
                            name: 'ramp_up',
                            progress: [0.0, 0.2],
                            patterns: [
                                [
                                    { pattern: 'dense_shore_mangroves', weight: 1 }
                                ]
                            ]
                        },
                        {
                            name: 'full_jungle',
                            progress: [0.2, 1.0],
                            patterns: [
                                [
                                    { pattern: 'dense_shore_mangroves', weight: 1 }
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'obstacles',
                    stages: [
                        {
                            name: 'standard',
                            progress: [0.0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'log_scatter', weight: 3 },
                                    { pattern: 'grass_patches', weight: 1.5 },
                                    { pattern: 'lilly_patches', weight: 6.0 }
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'rewards',
                    stages: [
                        {
                            name: 'bottles',
                            progress: [0.0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'clear_channel_bottles', weight: 1 }
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'threats',
                    stages: [
                        {
                            name: 'threats',
                            progress: [0.2, 1.0],
                            patterns: [
                                [
                                    { pattern: 'threat_ambush', weight: 1 },
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'friends',
                    stages: [
                        {
                            name: 'threats',
                            progress: [0.0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'egret_flight', weight: 1 },
                                    { pattern: 'dragonfly_buzz', weight: 1 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.ALLIGATOR, EntityIds.SNAKE, EntityIds.EGRET, EntityIds.DRAGONFLY]
        });

        return this.layoutCache;
    }


    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const riverSystem = context.chunk.riverSystem;

        const length = zEnd - zStart;
        // Increase count to cover the wider area
        // River density is ~30 per 100m (concentrated).
        // Shore area is much wider (~150m per side).
        // Let's try 40 per 100m segment to give decent scattered coverage.
        const count = Math.ceil(length * 0.4);

        for (let i = 0; i < count; i++) {
            if (i % 20 === 0) yield;
            const z = zStart + Math.random() * length;
            const riverWidth = riverSystem.getRiverWidth(z);
            const riverCenter = riverSystem.getRiverCenter(z);

            // Pick side
            const side = Math.random() > 0.5 ? 1 : -1;

            // Distance from bank: 5m to 140m
            // Avoid immediate bank to reduce clip with gameplay elements, spread far out
            const distFromBank = 5 + Math.random() * 50;

            const x = riverCenter + side * (riverWidth / 2 + distFromBank);

            const height = riverSystem.terrainGeometry.calculateHeight(x, z);

            const mangrove = Decorations.getMangrove(1.0 + Math.random() * 0.5);

            context.decoHelper.positionAndCollectGeometry(mangrove, { worldX: x, worldZ: z, height }, context);
        }
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}

