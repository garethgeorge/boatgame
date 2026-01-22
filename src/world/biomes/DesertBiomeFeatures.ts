import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations } from '../Decorations';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
    }

    protected skyTopColors: number[] = [0x04193c, 0x05559c, 0x058fea]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x024b82, 0xafd9ae, 0x53baf5]; // [Night, Sunset, Noon]

    public getBiomeLength(): number {
        return 2000;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'animal_corridor': {
                    logic: 'sequence',
                    place: 'shore',
                    density: [0.5, 4.0],
                    types: [EntityIds.ALLIGATOR, EntityIds.MONKEY]
                },
                'hippo_pod': {
                    logic: 'cluster',
                    place: 'shore',
                    density: [0.3, 2.0],
                    types: [EntityIds.HIPPO],
                    minCount: 2
                },
                'rocky_slalom': {
                    logic: 'sequence',
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: [EntityIds.ROCK]
                },
                'rock_stagger': {
                    logic: 'staggered',
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: [EntityIds.ROCK],
                    minCount: 3
                },
                'bottle_cluster': {
                    logic: 'cluster',
                    place: 'path',
                    density: [1.5, 0.5],
                    types: [EntityIds.BOTTLE],
                    minCount: 3
                }
            },
            tracks: [
                {
                    name: 'main',
                    stages: [
                        {
                            name: 'intro',
                            progress: [0, 0.4],
                            patterns: [
                                [
                                    { pattern: 'rocky_slalom', weight: 1 },
                                    { pattern: 'rock_stagger', weight: 1 }
                                ]
                            ]
                        },
                        {
                            name: 'gauntlet',
                            progress: [0.3, 0.9],
                            patterns: [
                                [
                                    { pattern: 'animal_corridor', weight: 2 },
                                    { pattern: 'hippo_pod', weight: 1 }
                                ],
                                [
                                    { pattern: 'rocky_slalom', weight: 1 },
                                    { pattern: 'rock_stagger', weight: 1 }
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'unique_elements',
                    placements: [
                        { name: 'dock', place: 'shore', at: 0.95, type: EntityIds.PIER }
                    ]
                },
                {
                    name: 'rewards',
                    stages: [
                        {
                            name: 'bottles',
                            progress: [0.0, 0.9],
                            patterns: [
                                [
                                    { pattern: 'bottle_cluster', weight: 1 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.HIPPO]
        });
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void, void, unknown> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            if (i % 20 === 0) yield;
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rand = Math.random();
            if (rand > 0.95) {
                const cactusInstances = Decorations.getCactusInstance();
                context.decoHelper.addInstancedDecoration(context, cactusInstances, position);
            } else if (rand > 0.90) {
                const rockInstances = Decorations.getRockInstance(this.id, Math.random());
                context.decoHelper.addInstancedDecoration(context, rockInstances, position);
            }
        }
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, context.biomeLayout, this.id, zStart, zEnd);
    }

}
