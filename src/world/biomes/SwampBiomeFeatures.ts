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

type SwampEntityType = EntityIds.MANGROVE | EntityIds.LOG | EntityIds.BOTTLE | EntityIds.ALLIGATOR | EntityIds.WATER_GRASS;

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';


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

    getBiomeLength(): number {
        return 1600;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout<SwampEntityType> {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'dense_shore_mangroves': {
                    logic: 'scatter',
                    place: 'shore',
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
                'alligator_ambush': {
                    logic: 'scatter',
                    place: 'path',
                    density: [0.2, 0.6],
                    types: [EntityIds.ALLIGATOR]
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
                                    { pattern: 'grass_patches', weight: 1.5 }
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
                            name: 'alligators',
                            progress: [0.2, 1.0],
                            patterns: [
                                [
                                    { pattern: 'alligator_ambush', weight: 1 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.ALLIGATOR]
        });
    }


    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        // Increase count to cover the wider area
        // River density is ~30 per 100m (concentrated).
        // Shore area is much wider (~150m per side).
        // Let's try 40 per 100m segment to give decent scattered coverage.
        const count = Math.ceil(length * 0.4);

        for (let i = 0; i < count; i++) {
            const z = zStart + Math.random() * length;
            const riverWidth = context.riverSystem.getRiverWidth(z);
            const riverCenter = context.riverSystem.getRiverCenter(z);

            // Pick side
            const side = Math.random() > 0.5 ? 1 : -1;

            // Distance from bank: 5m to 140m
            // Avoid immediate bank to reduce clip with gameplay elements, spread far out
            const distFromBank = 5 + Math.random() * 50;

            const x = riverCenter + side * (riverWidth / 2 + distFromBank);

            const height = context.riverSystem.terrainGeometry.calculateHeight(x, z);

            const mangrove = Decorations.getMangrove(1.0 + Math.random() * 0.5);

            context.decoHelper.positionAndCollectGeometry(mangrove, { worldX: x, worldZ: z, height }, context);
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const layout = context.biomeLayout as BoatPathLayout<SwampEntityType>;
        if (!layout) {
            // Fallback to legacy spawning if no layout
            await this.spawnObstacle(EntitySpawners.getInstance().mangrove(), context, difficulty, zStart, zEnd);
            return;
        }

        // Map world Z range to path indices
        const iChunkStart = RiverGeometry.getPathIndexByZ(layout.path, zStart);
        const iChunkEnd = RiverGeometry.getPathIndexByZ(layout.path, zEnd);

        const iChunkMin = Math.min(iChunkStart, iChunkEnd);
        const iChunkMax = Math.max(iChunkStart, iChunkEnd);

        for (const section of layout.sections) {
            // Check if section overlaps with current segment arc length range
            if (section.iEnd <= iChunkMin || section.iStart >= iChunkMax) {
                continue;
            }

            // Iterate through each entity type in the section
            for (const [entityType, placements] of Object.entries(section.placements)) {
                if (!placements) continue;

                for (const p of placements) {
                    // Check if placement is within current segment
                    if (p.index >= iChunkMin && p.index < iChunkMax) {
                        const sample = RiverGeometry.getPathPoint(layout.path, p.index);

                        switch (entityType as SwampEntityType) {
                            case EntityIds.MANGROVE: {
                                // spawnAbsolute takes (x, z). 
                                // The point is center + normal * offset. 
                                // offset is uniform random in [p.range[0], p.range[1]]
                                const offset = p.range[0] + Math.random() * (p.range[1] - p.range[0]);
                                await EntitySpawners.getInstance().mangrove().spawnAbsolute(
                                    context,
                                    sample.centerPos.x + sample.normal.x * offset,
                                    sample.centerPos.z + sample.normal.z * offset
                                );
                                break;
                            }
                            case EntityIds.LOG: {
                                await EntitySpawners.getInstance().log().spawnInRiverAbsolute(
                                    context, sample, p.range
                                );
                                break;
                            }
                            case EntityIds.BOTTLE: {
                                await EntitySpawners.getInstance().messageInABottle().spawnInRiverAbsolute(
                                    context, sample, p.range
                                );
                                break;
                            }
                            case EntityIds.ALLIGATOR: {
                                const logic = 'ambush'; // Mainly ambush in swamp
                                // Bias towards middle area: [-10, 10]
                                await EntitySpawners.getInstance().attackAnimal(EntityIds.ALLIGATOR)!.spawnAnimalAbsolute(
                                    context, sample, [-10, 10], p.aggressiveness || 0.5, logic
                                );
                                break;
                            }
                            case EntityIds.WATER_GRASS: {
                                await EntitySpawners.getInstance().waterGrass().spawnInRiverAbsolute(
                                    context, sample, p.range
                                );
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}

