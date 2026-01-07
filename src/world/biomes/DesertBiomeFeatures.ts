import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { RiverGeometry } from '../RiverGeometry';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';

type DesertEntityType = 'rock' | 'bottle' | 'monkey' | 'gator' | 'hippo' | 'dock';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';

    private alligatorSpawner = new AlligatorSpawner();
    private hippoSpawner = new HippoSpawner();
    private monkeySpawner = new MonkeySpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
    }

    public getBiomeLength(): number {
        return 2000;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout<DesertEntityType> {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'animal_corridor': {
                    logic: 'sequence',
                    place: 'shore',
                    density: [0.5, 2.0],
                    types: ['gator', 'monkey']
                },
                'hippo_pod': {
                    logic: 'cluster',
                    place: 'shore',
                    density: [0.3, 1.5],
                    types: ['hippo'],
                    minCount: 2
                },
                'rocky_slalom': {
                    logic: 'sequence',
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: ['rock']
                },
                'rock_stagger': {
                    logic: 'staggered',
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: ['rock'],
                    minCount: 3
                },
                'bottle_cluster': {
                    logic: 'cluster',
                    place: 'path',
                    density: [1.5, 0.5],
                    types: ['bottle'],
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
                        { name: 'dock', place: 'shore', at: 0.95, type: 'dock' }
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
            waterAnimals: ['hippo']
        });
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rand = Math.random();
            if (rand > 0.95) {
                const cactus = Decorations.getCactus();
                context.decoHelper.positionAndCollectGeometry(cactus, position, context);
            } else if (rand > 0.90) {
                const rock = Decorations.getRock(this.id, Math.random());
                context.decoHelper.positionAndCollectGeometry(rock, position, context);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const layout = context.biomeLayout as BoatPathLayout<DesertEntityType>;
        if (!layout) return;

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

                        switch (entityType as DesertEntityType) {
                            case 'rock': {
                                const pillars = Math.random() < 0.3;
                                await this.rockSpawner.spawnInRiverAbsolute(
                                    context, sample, pillars, 'desert', p.range
                                );
                                break;
                            }
                            case 'bottle': {
                                await this.bottleSpawner.spawnInRiverAbsolute(
                                    context, sample, p.range
                                );
                                break;
                            }
                            case 'gator': {
                                const logic = Math.random() < 0.5 ? 'wolf' : 'ambush';
                                await this.alligatorSpawner.spawnAnimalAbsolute(
                                    context, sample, p.range, p.aggressiveness || 0.5, logic
                                );
                                break;
                            }
                            case 'monkey': {
                                const logic = Math.random() < 0.5 ? 'wolf' : 'ambush';
                                await this.monkeySpawner.spawnAnimalAbsolute(
                                    context, sample, p.range, p.aggressiveness || 0.5, logic
                                );
                                break;
                            }
                            case 'hippo': {
                                const logic = Math.random() < 0.5 ? 'wolf' : 'ambush';
                                await this.hippoSpawner.spawnAnimalAbsolute(
                                    context, sample, p.range, p.aggressiveness || 0.5, logic
                                );
                                break;
                            }
                            case 'dock': {
                                await this.pierSpawner.spawnAt(
                                    context, sample.centerPos.z, true);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

}
