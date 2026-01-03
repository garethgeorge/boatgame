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
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { RiverGeometry } from '../RiverGeometry';

type JurassicEntityType = 'log' | 'rock' | 'bottle' | 'trex' | 'triceratops' | 'bronto' | 'pterodactyl';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';

    private trexSpawner = new TRexSpawner();
    private triceratopsSpawner = new TriceratopsSpawner();
    private brontoSpawner = new BrontosaurusSpawner();
    private pterodactylSpawner = new PterodactylSpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x2E / 255, g: 0x4B / 255, b: 0x2E / 255 };
    }

    getFogDensity(): number {
        return 0.3;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 50, far: 600 };
    }

    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color } {
        const colors = super.getSkyColors(dayness);
        if (dayness > 0) {
            const jurassicTopMod = new THREE.Color(0xaaffaa); // Very Green
            const jurassicBotMod = new THREE.Color(0xccffcc); // Pale Green Horizon
            colors.top.lerp(jurassicTopMod, 0.4);
            colors.bottom.lerp(jurassicBotMod, 0.4);
        }
        return colors;
    }

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
                                    { pattern: 'staggered_logs', weight: 0.5 }
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
                const cycad = Decorations.getCycad();
                context.decoHelper.positionAndCollectGeometry(cycad, position, context);
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
                                await this.pterodactylSpawner.spawnAnimalAbsolute(context, sample, p.range);
                                break;
                        }
                    }
                }
            }
        }
    }
}
