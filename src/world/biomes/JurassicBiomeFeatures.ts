import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations } from '../Decorations';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, JurassicBiomeFeatures.LENGTH, direction);
    }

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

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: {
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
                    place: 'shore',
                    density: [0.5, 1.5],
                    types: [EntityIds.TREX, EntityIds.TRICERATOPS]
                },
                'ptero_scatter': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [0.5, 1.5],
                    types: [EntityIds.PTERODACTYL]
                },
                'bronto_migration': {
                    logic: 'sequence',
                    place: 'shore',
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
                    place: 'shore',
                    density: [1.5, 3.0],
                    types: [EntityIds.WATER_GRASS]
                }
            },
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

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void, void, unknown> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 20); // Denser

        for (let i = 0; i < count; i++) {
            if (i % 20 === 0) yield;
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rand = Math.random();
            if (rand > 0.8) {
                const cycadInstances = Decorations.getCycadInstance();
                context.decoHelper.addInstancedDecoration(context, cycadInstances, position);
            } else if (rand > 0.6) {
                const fernInstances = Decorations.getTreeFernInstance();
                context.decoHelper.addInstancedDecoration(context, fernInstances, position);
            } else if (rand > 0.55) {
                const rockInstances = Decorations.getRockInstance(this.id, Math.random());
                context.decoHelper.addInstancedDecoration(context, rockInstances, position);
            }
        }
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd);
    }
}
