import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { TRexSpawner } from '../../entities/spawners/TRexSpawner';
import { TriceratopsSpawner } from '../../entities/spawners/TriceratopsSpawner';
import { BrontosaurusSpawner } from '../../entities/spawners/BrontosaurusSpawner';
import { PterodactylSpawner } from '../../entities/spawners/PterodactylSpawner';
import { WaterGrassSpawner } from '../../entities/spawners/WaterGrassSpawner';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { RiverGeometry } from '../RiverGeometry';

type JurassicEntityType = 'log' | 'rock' | 'bottle' | 'trex' | 'triceratops' | 'bronto' | 'pterodactyl' | 'water_grass';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';

    private trexSpawner = new TRexSpawner();
    private triceratopsSpawner = new TriceratopsSpawner();
    private brontoSpawner = new BrontosaurusSpawner();
    private pterodactylSpawner = new PterodactylSpawner();
    private waterGrassSpawner = new WaterGrassSpawner();


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

    public getBiomeLength(): number {
        return 2000;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout<JurassicEntityType> {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'scattered_rocks': {
                    logic: 'scatter',
                    place: 'slalom',
                    density: [1.0, 3.0],
                    types: ['rock']
                },
                'staggered_logs': {
                    logic: 'staggered',
                    place: 'slalom',
                    density: [0.5, 1.5],
                    types: ['log'],
                    minCount: 4
                },
                'dino_scatter': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [0.5, 1.5],
                    types: ['trex', 'triceratops']
                },
                'ptero_scatter': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [0.5, 1.5],
                    types: ['pterodactyl']
                },
                'bronto_migration': {
                    logic: 'sequence',
                    place: 'shore',
                    density: [0.4, 0.4],
                    types: ['bronto']
                },
                'bottle_hunt': {
                    logic: 'scatter',
                    place: 'path',
                    density: [0.25, 0.5],
                    types: ['bottle']
                },
                'grass_patches': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [1.5, 3.0],
                    types: ['water_grass']
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
            waterAnimals: ['bronto']
        });
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 20); // Denser

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rand = Math.random();
            if (rand > 0.8) {
                const cycadInstances = Decorations.getCycadInstance();
                context.decoHelper.addInstancedDecoration(context, cycadInstances, position);
            } else if (rand > 0.6) {
                const fern = Decorations.getTreeFern();
                context.decoHelper.positionAndCollectGeometry(fern, position, context);
            } else if (rand > 0.55) {
                const rock = Decorations.getRock(this.id, Math.random());
                context.decoHelper.positionAndCollectGeometry(rock, position, context);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const layout = context.biomeLayout as BoatPathLayout<JurassicEntityType>;
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

                        switch (entityType as JurassicEntityType) {
                            case 'log':
                                await this.logSpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                            case 'rock':
                                await this.rockSpawner.spawnInRiverAbsolute(context, sample, false, 'jurassic', p.range);
                                break;
                            case 'bottle':
                                await this.bottleSpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                            case 'trex':
                                await this.trexSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'triceratops':
                                await this.triceratopsSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'bronto':
                                await this.brontoSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'pterodactyl':
                                await this.pterodactylSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
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
