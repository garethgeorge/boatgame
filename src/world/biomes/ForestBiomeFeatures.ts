import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { BrownBearSpawner } from '../../entities/spawners/BrownBearSpawner';
import { MooseSpawner } from '../../entities/spawners/MooseSpawner';
import { DucklingSpawner } from '../../entities/spawners/DucklingSpawner';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { WaterGrassSpawner } from '../../entities/spawners/WaterGrassSpawner';
import { RiverGeometry } from '../RiverGeometry';

type ForestEntityType = 'log' | 'rock' | 'buoy' | 'bear' | 'moose' | 'duckling' | 'pier' | 'water_grass';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';

    private bearSpawner = new BrownBearSpawner();
    private mooseSpawner = new MooseSpawner();
    private ducklingSpawner = new DucklingSpawner();
    private waterGrassSpawner = new WaterGrassSpawner();


    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 };
    }

    protected skyTopColors: number[] = [0x0b1517, 0x455d96, 0x0067b6]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x2b4f68, 0xede6da, 0xb1daec]; // [Night, Sunset, Noon]

    public getBiomeLength(): number {
        return 2000;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout<ForestEntityType> {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'forest_slalom': {
                    logic: 'scatter',
                    place: 'slalom',
                    density: [1.0, 2.0],
                    types: ['log', 'rock', 'buoy']
                },
                'rock_gates': {
                    logic: 'gate',
                    place: 'slalom',
                    density: [1.0, 2.0],
                    types: ['rock'],
                    minCount: 2
                },
                'piers': {
                    logic: 'staggered',
                    place: 'slalom',
                    density: [0.3, 0.9],
                    types: ['pier'],
                    minCount: 2
                },
                'forest_animals': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [0.8, 2.5],
                    types: ['bear', 'moose']
                },
                'duckling_train': {
                    logic: 'sequence',
                    place: 'path',
                    density: [0.5, 1.5],
                    types: ['duckling'],
                    minCount: 3
                },
                'grass_patches': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [1.0, 2.0],
                    types: ['water_grass']
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
            waterAnimals: ['duckling']
        });
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            if (Math.random() > 0.8) {
                const treeInstances = Decorations.getTreeInstance(Math.random(), 'default', false, false);
                context.decoHelper.addInstancedDecoration(context, treeInstances, position);
            } else if (Math.random() > 0.95) {
                const rockInstances = Decorations.getRockInstance(this.id, Math.random());
                context.decoHelper.addInstancedDecoration(context, rockInstances, position);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const layout = context.biomeLayout as BoatPathLayout<ForestEntityType>;
        if (!layout) return;

        // Map world Z range to path indices
        const iChunkStart = RiverGeometry.getPathIndexByZ(layout.path, zStart);
        const iChunkEnd = RiverGeometry.getPathIndexByZ(layout.path, zEnd);

        const iChunkMin = Math.min(iChunkStart, iChunkEnd);
        const iChunkMax = Math.max(iChunkStart, iChunkEnd);

        for (const section of layout.sections) {
            if (section.iEnd <= iChunkMin || section.iStart >= iChunkMax) continue;

            for (const [entityType, placements] of Object.entries(section.placements)) {
                if (!placements) continue;

                for (const p of placements) {
                    if (p.index >= iChunkMin && p.index < iChunkMax) {
                        const sample = RiverGeometry.getPathPoint(layout.path, p.index);

                        switch (entityType as ForestEntityType) {
                            case 'log':
                                await this.logSpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                            case 'rock':
                                await this.rockSpawner.spawnInRiverAbsolute(context, sample, false, 'forest', p.range);
                                break;
                            case 'buoy':
                                await this.buoySpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                            case 'pier':
                                // For the forest, we can just spawn piers as slalom obstacles on the banks
                                await this.pierSpawner.spawnAt(context, sample.centerPos.z, Math.random() < 0.5);
                                break;
                            case 'moose':
                                await this.mooseSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'bear':
                                await this.bearSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'duckling':
                                await this.ducklingSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'water_grass':
                                await this.waterGrassSpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                        }
                    }
                }
            }
        }
    }
}
