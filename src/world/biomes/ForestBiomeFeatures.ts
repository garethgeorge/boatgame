import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations, LSystemTreeKind } from '../Decorations';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';

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
        const length = zEnd - zStart;
        // Forest is denser than Happy biome (1.0), but L-system trees are heavier than simple ones.
        // We'll use a moderate density.
        const count = Math.floor(length * 4);

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);

            if (Math.random() > 0.2) { // 80% trees
                // Consistent local type logic:
                // Use a low-frequency sine wave on Z to transition between forest types.
                // Add some noise to blend the edges.
                const zone = Math.sin(position.worldZ * 0.005) + (Math.random() * 0.4 - 0.2);

                let kind: LSystemTreeKind;

                // Check for Elder Tree spawn (Mother of the Forest)
                // Needs to be far from the bank and rare
                const riverWidth = context.riverSystem.getRiverWidth(position.worldZ);
                const riverCenter = context.riverSystem.getRiverCenter(position.worldZ);
                const distFromCenter = Math.abs(position.worldX - riverCenter);
                const distFromBank = distFromCenter - riverWidth / 2;

                if (distFromBank > 60 && Math.random() < 0.04) {
                    kind = 'elder';
                } else {
                    if (zone > 0) {
                        kind = 'birch';
                    } else {
                        kind = 'oak';
                    }
                }

                // Variation is just random for now
                const variation = Math.random();
                const treeInstances = Decorations.getLSystemTreeInstance({ kind, variation });
                
                // Calculate height of the generated tree
                const objectHeight = context.decoHelper.calculateHeight(treeInstances);

                // Now validate position with the specific object height
                if (context.decoHelper.isValidDecorationPosition(context, position, 2.0, objectHeight)) {
                    context.decoHelper.addInstancedDecoration(context, treeInstances, position);
                }

            } else if (Math.random() > 0.5) { // Remaining 20% split between rocks and empty
                const rockInstances = Decorations.getRockInstance(this.id, Math.random());
                const objectHeight = context.decoHelper.calculateHeight(rockInstances);

                if (context.decoHelper.isValidDecorationPosition(context, position, 2.0, objectHeight)) {
                    context.decoHelper.addInstancedDecoration(context, rockInstances, position);
                }
            }
        }
    }
    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await BoatPathLayoutSpawner.getInstance().spawn(context, context.biomeLayout, this.id, zStart, zEnd);
    }
}
