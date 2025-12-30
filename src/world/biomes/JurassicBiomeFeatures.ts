import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { TRexSpawner } from '../../entities/spawners/TRexSpawner';
import { TriceratopsSpawner } from '../../entities/spawners/TriceratopsSpawner';
import { BrontosaurusSpawner } from '../../entities/spawners/BrontosaurusSpawner';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { RiverGeometry } from '../RiverGeometry';

type JurassicEntityType = 'log' | 'rock' | 'bottle' | 'trex' | 'triceratops' | 'bronto';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';

    private trexSpawner = new TRexSpawner();
    private triceratopsSpawner = new TriceratopsSpawner();
    private brontoSpawner = new BrontosaurusSpawner();

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
            animalGroups: [['trex', 'triceratops'], ['bronto']],
            slalomGroups: [['log', 'rock']],
            pathGroups: [['bottle']],
            waterAnimals: ['bronto'],
            weights: {
                'trex': 35, 'triceratops': 45, 'bronto': 20,
                'log': 2, 'rock': 1,
                'bottle': 1
            },
            slalomDensity: { start: 1.0, end: 3.0 },
            animalDensity: { start: 0.5, end: 1.5 },
            pathDensity: { start: 0.25, end: 0.5 },
            biomeLength: this.getBiomeLength()
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
                        }
                    }
                }
            }
        }
    }
}
