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

type DesertEntityType = 'rock' | 'bottle' | 'monkey' | 'gator' | 'hippo';

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
            animalGroups: [['hippo'], ['gator'], ['monkey']],
            slalomGroups: [['rock']],
            pathGroups: [['bottle']],
            waterAnimals: ['hippo'],
            weights: {
                'monkey': 1.0, 'hippo': 1.0, 'gator': 1.0,
                'rock': 1.0,
                'bottle': 1.0
            },
            slalomDensity: { start: 0.6, end: 1.5 },
            animalDensity: { start: 0.4, end: 1.2 },
            pathDensity: { start: 2.0, end: 2.0 },
            biomeLength: this.getBiomeLength()
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
                                await this.alligatorSpawner.spawnAnimalAbsolute(
                                    context, sample, p.range, p.aggressiveness || 0.5
                                );
                                break;
                            }
                            case 'monkey': {
                                await this.monkeySpawner.spawnAnimalAbsolute(
                                    context, sample, p.range, p.aggressiveness || 0.5
                                );
                                break;
                            }
                            case 'hippo': {
                                await this.hippoSpawner.spawnAnimalAbsolute(
                                    context, sample, p.range, p.aggressiveness || 0.5
                                );
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Pier spawning at the end of the biome
        const totalArcLength = layout.path[layout.path.length - 1].arcLength;
        const pierArcLength = totalArcLength * 0.95;
        const pierIndex = RiverGeometry.getPathIndexByArcLen(layout.path, pierArcLength);

        if (iChunkMin <= pierIndex && pierIndex < iChunkMax) {
            const sample = RiverGeometry.getPathPoint(layout.path, pierIndex);
            await this.pierSpawner.spawnAt(context, sample.centerPos.z, true);
        }
    }

}
