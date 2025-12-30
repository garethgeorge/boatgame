import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { RiverGeometrySample, RiverSystem } from '../RiverSystem';

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
        const path: PathPoint[] = riverSystem.sampleRiver(zStart, zEnd, 10.0).map((sample) => {
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

        // Return random fractional path index for the nth of count slots
        // within the range [iStart, iEnd] 
        const randomIndex = (n: number, count: number) => {
            const index = iStart + (n + Math.random() * 0.99) * (iEnd - iStart) / count;
            return index;
        };

        // --- Rock Barriers ---
        const baseRockSpacing = 150 - progress * 120;
        const rockSpacing = animalType === 'none' ? baseRockSpacing : baseRockSpacing * 1.5;

        const rockCount = Math.max(1, Math.floor(sectionLen / rockSpacing));
        for (let j = 0; j < rockCount; j++) {
            const pathIndex = randomIndex(j, rockCount);
            const pathPoint = this.getPathPoint(path, pathIndex);

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
                const pathIndex = randomIndex(j, animalCount);
                const pathPoint = this.getPathPoint(path, pathIndex);
                const boatOffset = pathPoint.boatXOffset;

                if (animalType === 'hippo') {
                    // Hippo near the bank opposite to the boat
                    const side = boatOffset > 0 ? -1 : 1;
                    const edgeDist = side > 0 ? pathPoint.rightBankDist : pathPoint.leftBankDist;
                    const dist = side * (edgeDist - 10);
                    placements['hippo']!.push({ index: pathIndex, range: [dist - 5, dist + 5] });
                } else {
                    // Gators/Monkeys on the banks (opposite to boat)
                    const side = boatOffset > 0 ? -1 : 1;
                    const range: [number, number] = side > 0 ?
                        [pathPoint.rightBankDist + 2, pathPoint.rightBankDist + 15] :
                        [-pathPoint.leftBankDist - 15, -pathPoint.leftBankDist - 2];
                    placements[animalType]!.push({ index: pathIndex, range });
                }
            }
        }

        // --- Bottles ---
        const bottleSpacing = 50;
        const bottleCount = Math.floor(sectionLen / bottleSpacing);
        for (let j = 0; j < bottleCount; j++) {
            const pathIndex = randomIndex(j, bottleCount);
            const pathPoint = this.getPathPoint(path, pathIndex);
            placements['bottle']!.push({
                index: pathIndex,
                range: [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2]
            });
        }

        return { iStart, iEnd, placements };
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
        const iChunkStart = this.getPathIndexByZ(layout.path, zStart);
        const iChunkEnd = this.getPathIndexByZ(layout.path, zEnd);

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
                        const sample = this.getPathPoint(layout.path, p.index);

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

        if (layout.path[iChunkMin].arcLength <= pierArcLength &&
            pierArcLength < layout.path[iChunkMax].arcLength) {
            const pierIndex = this.getPathIndexByArcLen(layout.path, pierArcLength);
            const sample = this.getPathPoint(layout.path, pierIndex);
            await this.pierSpawner.spawnAt(context, sample.centerPos.z, true);
        }
    }

    /**
     * Get path point given a fractional index
     */
    private getPathPoint(points: PathPoint[], index: number): PathPoint {
        if (points.length === 0) throw new Error('Path is empty');

        const i = Math.floor(index);
        if (i + 1 >= points.length)
            return points[points.length - 1];
        const t = index - i;
        const p1 = points[i];
        const p2 = points[i + 1];
        return this.interpolatePathPoint(p1, p2, t);
    }

    /**
     * Get an interpolated location between two points
     */
    private interpolatePathPoint(p1: PathPoint, p2: PathPoint, t: number): PathPoint {
        return {
            centerPos: {
                x: p1.centerPos.x + t * (p2.centerPos.x - p1.centerPos.x),
                z: p1.centerPos.z + t * (p2.centerPos.z - p1.centerPos.z)
            },
            tangent: {
                x: p1.tangent.x + t * (p2.tangent.x - p1.tangent.x),
                z: p1.tangent.z + t * (p2.tangent.z - p1.tangent.z)
            },
            normal: {
                x: p1.normal.x + t * (p2.normal.x - p1.normal.x),
                z: p1.normal.z + t * (p2.normal.z - p1.normal.z)
            },
            leftBankDist: p1.leftBankDist + t * (p2.leftBankDist - p1.leftBankDist),
            rightBankDist: p1.rightBankDist + t * (p2.rightBankDist - p1.rightBankDist),
            arcLength: p1.arcLength + t * (p2.arcLength - p1.arcLength),
            boatXOffset: p1.boatXOffset + t * (p2.boatXOffset - p1.boatXOffset)
        };
    }

    /**
     * Given an arc length find corresponding fractional index in the the path
     * point array.
     */
    private getPathIndexByArcLen(points: PathPoint[], arcLen: number): number {
        return this.binarySearchPath(points, arcLen, (point: PathPoint) => {
            return point.arcLength;
        })
    }

    /**
     * Given a worldZ find corresponding fractional index in the the path
     * point array. The path points may be in order of increasing or
     * decreasing z.
     */
    private getPathIndexByZ(points: PathPoint[], worldZ: number): number {
        return this.binarySearchPath(points, worldZ, (point: PathPoint) => {
            return point.centerPos.z;
        });
    }

    /**
     * Search for fractional index corresponding to a given value. The
     * values in the path must either be ascending or descending.
     */
    private binarySearchPath(points: PathPoint[], value: number,
        pointValue: (point: PathPoint) => number): number {

        const isAscending = pointValue(points[points.length - 1]) > pointValue(points[0]);

        let low = 0;
        let high = points.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midValue = pointValue(points[mid]);
            if (midValue === value) return mid;

            if (isAscending) {
                if (midValue < value) low = mid + 1;
                else high = mid - 1;
            } else {
                if (midValue > value) low = mid + 1;
                else high = mid - 1;
            }
        }

        if (high < 0) return 0;
        if (low >= points.length) return points.length;

        const p1 = points[high];
        const p2 = points[low];
        const delta = pointValue(p2) - pointValue(p1);
        const t = delta === 0 ? 0 : (value - pointValue(p1)) / delta;

        return high + t;
    }

}
