import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { RiverGeometry, RiverGeometrySample } from '../RiverGeometry';
import { RiverSystem } from '../RiverSystem';

interface PathPoint extends RiverGeometrySample {
    boatXOffset: number; // Offset from river center along the normal vector
}

interface ObstaclePlacement {
    index: number;  // index + fractional offset in path  
    range: [number, number]; // Distance range along the normal vector
}

type DesertEntityType = 'rock' | 'bottle' | 'monkey' | 'gator' | 'hippo';

interface DesertSection {
    iStart: number;
    iEnd: number;
    placements: Partial<Record<DesertEntityType, ObstaclePlacement[]>>;
}
interface DesertBiomeLayout {
    path: PathPoint[];
    sections: DesertSection[];
}

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

    public createLayout(zMin: number, zMax: number): DesertBiomeLayout {
        const riverSystem = RiverSystem.getInstance();

        // Drirection of travel is -ve z
        const zStart = zMax;
        const zEnd = zMin;

        // Sample the river every 10 units of arc length
        const path: PathPoint[] = RiverGeometry.sampleRiver(riverSystem, zStart, zEnd, 10.0).map((sample) => {
            const arcLength = sample.arcLength;

            // Weaving logic based on arc length
            const wavelength = 400 - (arcLength / 2000) * 280; // Assuming ~2000 total length
            const baseFreq = (2 * Math.PI) / wavelength;
            const detailFreq = baseFreq * 2.5;

            const normalizedX = Math.sin(arcLength * baseFreq) * 0.6 +
                Math.sin(arcLength * detailFreq) * 0.15;

            // Available movement range (width - safety margin)
            const margin = 5.0;
            const leftWidth = sample.leftBankDist - margin;
            const rightWidth = sample.rightBankDist - margin;
            const center = (rightWidth - leftWidth) / 2;
            const width = (rightWidth + leftWidth) / 2;
            const boatXOffset = center + normalizedX * width;

            return {
                ...sample,
                boatXOffset
            };
        });

        // Sectioning based on boat offset extrema
        const sections: DesertSection[] = [];
        let sectionStartIdx = 0;

        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1].boatXOffset;
            const curr = path[i].boatXOffset;
            const next = path[i + 1].boatXOffset;

            const isLocalMax = curr > prev && curr > next;
            const isLocalMin = curr < prev && curr < next;

            const currentArcLength = path[i].arcLength;
            const sectionArcLen = currentArcLength - path[sectionStartIdx].arcLength;

            if ((isLocalMax || isLocalMin) || sectionArcLen > 250) {
                if (sectionArcLen > 50) {
                    sections.push(this.populateSection(path, sectionStartIdx, i));
                    sectionStartIdx = i;
                }
            }
        }

        // Final section
        if (sectionStartIdx < path.length - 1) {
            sections.push(this.populateSection(path, sectionStartIdx, path.length - 1));
        }

        return { path, sections };
    }

    private populateSection(path: PathPoint[], iStart: number, iEnd: number): DesertSection {
        const placements: Partial<Record<DesertEntityType, ObstaclePlacement[]>> = {
            'rock': [],
            'bottle': []
        };

        const pathLength = path[path.length - 1].arcLength;
        const pathCutoff = 0.9 * pathLength;
        const sectionStart = path[iStart].arcLength;
        const sectionEnd = Math.min(path[iEnd].arcLength, pathCutoff);
        const sectionLen = sectionEnd - sectionStart;

        if (sectionLen <= 0) {
            return { iStart, iEnd, placements };
        }

        // Use mid point of section as progress along path
        const progress = 0.5 * (sectionStart + sectionEnd) / pathLength;

        // Animal selection
        const pNone = Math.max(0, 1.2 - progress * 1.5);
        let animalType: 'gator' | 'hippo' | 'monkey' | 'none';
        if (Math.random() < pNone) {
            animalType = 'none';
        } else {
            const types: ('gator' | 'hippo' | 'monkey')[] = ['gator', 'hippo', 'monkey'];
            animalType = types[Math.floor(Math.random() * types.length)];
        }

        // --- Rock Barriers ---
        const baseRockSpacing = 150 - progress * 120;
        const rockSpacing = animalType === 'none' ? baseRockSpacing : baseRockSpacing * 1.5;

        const rockCount = Math.max(1, Math.floor(sectionLen / rockSpacing));
        for (let j = 0; j < rockCount; j++) {
            const pathIndex = this.randomIndex(iStart, iEnd, j, rockCount);
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            // Place rocks on the "opposite" side of the boat path to create a slalom
            // If boat is at offset > 0 (right), place rocks on the left side (negative d)
            const boatOffset = pathPoint.boatXOffset;

            let range: [number, number];
            if (boatOffset > 0) {
                // Rock on left-side (negative d)
                // Range should be between left bank and somewhat close to center or boat
                range = [-pathPoint.leftBankDist + 2.0, boatOffset - 5.0];
            } else {
                // Rock on right-side (positive d)
                range = [boatOffset + 5.0, pathPoint.rightBankDist - 2.0];
            }
            placements['rock']!.push({ index: pathIndex, range });
        }

        // --- Animals ---
        if (animalType !== 'none') {
            placements[animalType] = [];
            const animalSpacing = 100 - progress * 60;
            const animalCount = Math.floor(sectionLen / animalSpacing) + (Math.random() < 0.2 ? 1 : 0);
            for (let j = 0; j < animalCount; j++) {
                const pathIndex = this.randomIndex(iStart, iEnd, j, animalCount);
                const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);
                const boatOffset = pathPoint.boatXOffset;

                if (animalType === 'hippo') {
                    // Hippo near the bank opposite to the boat
                    const range: [number, number] = boatOffset < 0 ?
                        [0.5 * pathPoint.rightBankDist, pathPoint.rightBankDist] :
                        [-pathPoint.leftBankDist, 0.5 * -pathPoint.leftBankDist];
                    placements['hippo']!.push({ index: pathIndex, range });
                } else {
                    // Gators/Monkeys on the banks (opposite to boat)
                    const range: [number, number] = boatOffset < 0 ?
                        [0.5 * pathPoint.rightBankDist, pathPoint.rightBankDist + 15] :
                        [-pathPoint.leftBankDist - 15, 0.5 * -pathPoint.leftBankDist];
                    placements[animalType]!.push({ index: pathIndex, range });
                }
            }
        }

        // --- Bottles ---
        const bottleSpacing = 50;
        const bottleCount = Math.floor(sectionLen / bottleSpacing);
        for (let j = 0; j < bottleCount; j++) {
            const pathIndex = this.randomIndex(iStart, iEnd, j, bottleCount);
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);
            placements['bottle']!.push({
                index: pathIndex,
                range: [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2]
            });
        }

        return { iStart, iEnd, placements };
    }

    private randomIndex(iStart: number, iEnd: number, n: number, count: number) {
        const index = iStart + (n + Math.random() * 0.99) * (iEnd - iStart) / count;
        return index;
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
        const layout = context.biomeLayout as DesertBiomeLayout;
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
                                const radius = 1.5 + Math.random() * 3.0;
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
                                    context, sample, p.range
                                );
                                break;
                            }
                            case 'monkey': {
                                await this.monkeySpawner.spawnAnimalAbsolute(
                                    context, sample, p.range
                                );
                                break;
                            }
                            case 'hippo': {
                                await this.hippoSpawner.spawnAnimalAbsolute(
                                    context, sample, p.range
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
