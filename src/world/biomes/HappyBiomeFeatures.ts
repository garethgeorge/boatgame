import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { DolphinSpawner } from '../../entities/spawners/DolphinSpawner';
import { RiverGeometry } from '../RiverGeometry';
import { FlowerDecorator } from '../decorators/FlowerDecorator';

type HappyEntityType = 'dolphin' | 'bottle';

/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Currently empty of decorations and obstacles.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';

    private dolphinSpawner = new DolphinSpawner();
    private flowerDecorator = new FlowerDecorator();

    getGroundColor(): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        // Use a lighter, more neutral tint for the happy biome to avoid washing out the sky
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    protected skyTopColors: number[] = [0x303948, 0xf6b581, 0x01cad1]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x5b6831, 0xf7efbc, 0xb0ece6]; // [Night, Sunset, Noon]

    public getBiomeLength(): number {
        return 1500;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout<HappyEntityType> {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'dolphin_pods': {
                    logic: 'scatter',
                    place: 'slalom',
                    density: [1.0, 2.0],
                    types: ['dolphin']
                }
            },
            tracks: [
                {
                    name: 'animals',
                    stages: [
                        {
                            name: 'dolphin_waters',
                            progress: [0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'dolphin_pods', weight: 1.0 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: ['dolphin']
        });
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        await this.flowerDecorator.decorate(context, zStart, zEnd);
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const layout = context.biomeLayout as BoatPathLayout<HappyEntityType>;
        if (!layout) return;

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

                        switch (entityType as HappyEntityType) {
                            case 'dolphin':
                                await this.dolphinSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'bottle':
                                await this.bottleSpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                        }
                    }
                }
            }
        }
    }
}
