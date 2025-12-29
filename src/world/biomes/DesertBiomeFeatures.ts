import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';

interface PathPoint {
    zOffset: number;
    xOffset: number; // -1 to 1 normalized river center offset
}

interface ObstaclePlacement {
    lZ: number;
    range: [number, number];
}

type DesertEntityType = 'rock' | 'bottle' | 'monkey' | 'gator' | 'hippo';

interface DesertSection {
    zStart: number;
    zEnd: number;
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

    public createLayout(length: number, zStart: number): DesertBiomeLayout {
        const path: PathPoint[] = [];
        const sections: DesertSection[] = [];
        const step = 10;

        // Path generation
        for (let z = 0; z <= length; z += step) {
            const progress = z / length;
            // Difficulty increases: wavelength decreases from ~400 down to ~120
            const wavelength = 400 - progress * 280;

            // Add some "character" to the path with a second frequency
            const baseFreq = (2 * Math.PI) / wavelength;
            const detailFreq = baseFreq * 2.5;

            const xOffset = Math.sin(z * baseFreq) * 0.6 +
                Math.sin(z * detailFreq) * 0.15;

            // Clamp to [-0.75, 0.75] to avoid hitting banks
            const clampedX = Math.max(-0.75, Math.min(0.75, xOffset));
            path.push({ zOffset: z, xOffset: clampedX });
        }

        // Sectioning based on bank proximity (extrema)
        let sectionStart = 0;

        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1].xOffset;
            const curr = path[i].xOffset;
            const next = path[i + 1].xOffset;

            const isLocalMax = curr > prev && curr > next;
            const isLocalMin = curr < prev && curr < next;
            const sectionOffset = path[i].zOffset;
            const sectionLen = sectionOffset - sectionStart;

            // Split at extrema or if too long
            if ((isLocalMax || isLocalMin) || sectionLen > 250) {
                // Ensure section is at least a minimum length to be meaningful
                if (sectionLen > 50) {
                    sections.push(this.populateSection(sectionStart, sectionOffset, path, length));
                    sectionStart = sectionOffset;
                }
            }
        }

        // Final section
        if (sectionStart < length) {
            sections.push(this.populateSection(sectionStart, length, path, length));
        }

        return { path, sections };
    }

    private populateSection(zStart: number, zEnd: number, path: PathPoint[], biomeLength: number): DesertSection {
        const placements: Partial<Record<DesertEntityType, ObstaclePlacement[]>> = {
            'rock': [],
            'bottle': []
        };

        const cutoffZ = 0.9 * biomeLength;
        const effectiveZEnd = Math.min(zEnd, cutoffZ);
        const effectiveLen = effectiveZEnd - zStart;

        // If the section is entirely beyond the cutoff, return empty placements
        if (effectiveLen <= 0) {
            return {
                zStart,
                zEnd,
                placements
            };
        }

        const progress = (zStart + effectiveZEnd) / (2 * biomeLength);

        // Animal selection: No animals at the start, gradually increasing probability
        const pNone = Math.max(0, 1.2 - progress * 1.5); // Starts at 1.0 (all 'none'), hits 0.0 at ~0.8 progress
        let animalType: 'gator' | 'hippo' | 'monkey' | 'none';
        if (Math.random() < pNone) {
            animalType = 'none';
        } else {
            const types: ('gator' | 'hippo' | 'monkey')[] = ['gator', 'hippo', 'monkey'];
            animalType = types[Math.floor(Math.random() * types.length)];
        }

        // --- Rock Barriers ---
        // Scale spacing: ~150 (sparse) at start down to ~30 (dense) at end
        const baseRockSpacing = 150 - progress * 120;
        // If there's an animal, increase rock spacing to avoid overcrowding
        const rockSpacing = animalType === 'none' ? baseRockSpacing : baseRockSpacing * 1.5;

        const rockCount = Math.max(1, Math.floor(effectiveLen / rockSpacing));
        const rockInterval = effectiveLen / rockCount;
        for (let j = 0; j < rockCount; j++) {
            const lZ = zStart + (j + Math.random()) * rockInterval;
            const pathX = this.getPathOffset(path, lZ);
            const range: [number, number] = pathX < 0.0 ? [pathX + 0.1, 0.5] : [-0.5, pathX - 0.1];
            placements['rock']!.push({ lZ, range });
        }

        // --- Animals ---
        if (animalType !== 'none') {
            placements[animalType] = [];
            // Scale animal spacing: ~100 at start of animal introduction down to ~40
            const animalSpacing = 100 - progress * 60;
            const animalCount = Math.floor(effectiveLen / animalSpacing) + (Math.random() < 0.2 ? 1 : 0);
            if (animalCount > 0) {
                const animalInterval = effectiveLen / animalCount;
                for (let j = 0; j < animalCount; j++) {
                    const lZ = zStart + (j + Math.random()) * animalInterval;
                    const pathX = this.getPathOffset(path, lZ);
                    const side = pathX < 0.0 ? 1.0 : -1.0;

                    if (animalType === 'hippo') {
                        placements['hippo']!.push({ lZ, range: [side * 0.7 - 0.15, side * 0.7 + 0.15] });
                    } else {
                        const range: [number, number] = side > 0 ? [0.9, 2.0] : [-2.0, -0.9];
                        placements[animalType]!.push({ lZ, range });
                    }
                }
            }
        }

        // --- Bottles ---
        const bottleSpacing = 50;
        const bottleCount = Math.floor(effectiveLen / bottleSpacing);
        if (bottleCount > 0) {
            const bottleInterval = effectiveLen / bottleCount;
            for (let j = 0; j < bottleCount; j++) {
                const lZ = zStart + (j + Math.random()) * bottleInterval;
                const pathX = this.getPathOffset(path, lZ);
                placements['bottle']!.push({ lZ, range: [pathX - 0.1, pathX + 0.1] });
            }
        }

        return {
            zStart,
            zEnd,
            placements
        };
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

    // e.g. if we enter biome at -10 and are at -12 then returns 2
    private worldToLayoutZ(worldZ: number, entranceZ: number): number {
        return entranceZ - worldZ;
    }

    // e.g. if we enter biome at -10 and are at 2 then returns -12
    private layoutToWorldZ(layoutZ: number, entranceZ: number): number {
        return entranceZ - layoutZ;
    }

    private getPathOffset(points: PathPoint[], zOffset: number): number {
        if (points.length === 0) return 0;

        // Binary search for zOffset in an ascending array [0, 10, 20, ...]
        let low = 0;
        let high = points.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (points[mid].zOffset === zOffset) return points[mid].xOffset;
            if (points[mid].zOffset < zOffset) low = mid + 1;
            else high = mid - 1;
        }

        if (high < 0) return points[0].xOffset;
        if (low >= points.length) return points[points.length - 1].xOffset;

        const p1 = points[high];
        const p2 = points[low];
        const t = (zOffset - p1.zOffset) / (p2.zOffset - p1.zOffset);
        return p1.xOffset + t * (p2.xOffset - p1.xOffset);
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const biomeEntranceZ = Math.max(context.biomeZStart, context.biomeZEnd);
        const biomeExitZ = Math.min(context.biomeZStart, context.biomeZEnd);
        const layout = context.biomeLayout as DesertBiomeLayout;

        const layoutZStart = this.worldToLayoutZ(zStart, biomeEntranceZ);
        const layoutZEnd = this.worldToLayoutZ(zEnd, biomeEntranceZ);
        const layoutMinZ = Math.min(layoutZStart, layoutZEnd);
        const layoutMaxZ = Math.max(layoutZStart, layoutZEnd);

        // 1. Process Sections
        for (const section of layout.sections) {
            // Find intersection between segment and section in Layout Space
            const isOverlap = layoutMinZ < section.zEnd && layoutMaxZ > section.zStart;
            if (isOverlap) {
                for (const [type, placements] of Object.entries(section.placements)) {
                    if (!placements) continue;
                    for (const p of placements) {
                        if (p.lZ < layoutMinZ || p.lZ >= layoutMaxZ) continue;
                        const worldZ = this.layoutToWorldZ(p.lZ, biomeEntranceZ);
                        switch (type as DesertEntityType) {
                            case 'rock': {
                                const pillars = Math.random() < 0.3;
                                await this.rockSpawner.spawnInRiver(context, worldZ, pillars, 'desert', { range: p.range });
                                break;
                            }
                            case 'bottle': {
                                await this.bottleSpawner.spawnInRiver(context, worldZ, { range: p.range });
                                break;
                            }
                            case 'gator': {
                                await this.alligatorSpawner.spawnAnimal(context, worldZ, p.range);
                                break;
                            }
                            case 'monkey': {
                                await this.monkeySpawner.spawnAnimal(context, worldZ, p.range);
                                break;
                            }
                            case 'hippo': {
                                await this.hippoSpawner.spawnInRiver(context, worldZ, false, { range: p.range });
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 3. Pier & Dock (End of biome)
        const pierT = 0.95;
        const pierZ = biomeEntranceZ + pierT * (biomeExitZ - biomeEntranceZ);
        const segmentMinWorldZ = Math.min(zStart, zEnd);
        const segmentMaxWorldZ = Math.max(zStart, zEnd);

        if (segmentMinWorldZ <= pierZ && pierZ < segmentMaxWorldZ) {
            await this.pierSpawner.spawnAt(context, pierZ, true);
        }
    }
}
