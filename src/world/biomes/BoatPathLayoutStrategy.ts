import { RiverGeometry, RiverGeometrySample } from '../RiverGeometry';
import { RiverSystem } from '../RiverSystem';

export interface PathPoint extends RiverGeometrySample {
    boatXOffset: number; // Offset from river center along the normal vector
}

export interface ObstaclePlacement {
    index: number;  // index + fractional offset in path  
    range: [number, number]; // Distance range along the normal vector
    aggressiveness?: number;
}

export interface BoatPathSection<T extends string> {
    iStart: number;
    iEnd: number;
    placements: Partial<Record<T, ObstaclePlacement[]>>;
}

export interface BoatPathLayout<T extends string> {
    path: PathPoint[];
    sections: BoatPathSection<T>[];
}

export interface DensityConfig {
    start: number; // expected instances per 100m
    end: number;   // expected instances per 100m
}

export interface SectionPattern<T extends string> {
    name: string;
    weight: number;
    logic: 'scatter' | 'sequence' | 'gate' | 'staggered';
    types: T[];
    densityMultiplier?: number;
    minCount?: number;
    maxCount?: number;
}

export interface BoatPathLayoutConfig<T extends string> {
    animalPatterns: SectionPattern<T>[];
    slalomPatterns: SectionPattern<T>[];
    pathPatterns: SectionPattern<T>[];
    waterAnimals: T[];
    slalomDensity: DensityConfig;
    animalDensity: DensityConfig;
    pathDensity: DensityConfig;
    biomeLength: number;
}

export class BoatPathLayoutStrategy {
    public static createLayout<T extends string>(
        zMin: number,
        zMax: number,
        config: BoatPathLayoutConfig<T>
    ): BoatPathLayout<T> {
        const riverSystem = RiverSystem.getInstance();

        // Direction of travel is -ve z
        const zStart = zMax;
        const zEnd = zMin;

        // Sample the river every 10 units of arc length
        const path: PathPoint[] = RiverGeometry.sampleRiver(riverSystem, zStart, zEnd, 10.0).map((sample) => {
            const arcLength = sample.arcLength;

            // Weaving logic based on arc length
            const wavelength = 400 - (arcLength / config.biomeLength) * 280;
            const baseFreq = (2 * Math.PI) / wavelength;
            const detailFreq = baseFreq * 2.5;

            const normalizedX = Math.sin(arcLength * baseFreq) * 0.6 +
                Math.sin(arcLength * detailFreq) * 0.15;

            // Available movement range (width - safety margin)
            const margin = 5.0;
            const width = sample.bankDist - margin;
            const boatXOffset = normalizedX * width;

            return {
                ...sample,
                boatXOffset
            };
        });

        // Detect center-crossing points
        const sections: BoatPathSection<T>[] = [];
        let sectionStartIdx = 0;

        for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1];
            const curr = path[i];

            const prevSide = prev.boatXOffset > 0;
            const currSide = curr.boatXOffset > 0;

            if (prevSide !== currSide || i === path.length - 1) {
                const iEnd = i;
                if (iEnd - sectionStartIdx > 2) {
                    // Midpoint determines the boat side for the section
                    const midIdx = Math.floor((sectionStartIdx + iEnd) / 2);
                    const midValue = path[midIdx].boatXOffset;
                    const boatIsOnRight = midValue > 0;
                    const targetSide = boatIsOnRight ? 'left' : 'right';

                    sections.push(this.populateSection(path, sectionStartIdx, iEnd, config, targetSide));
                }
                sectionStartIdx = i;
            }
        }

        return { path, sections };
    }

    private static populateSection<T extends string>(
        path: PathPoint[],
        iStart: number,
        iEnd: number,
        config: BoatPathLayoutConfig<T>,
        side: 'left' | 'right'
    ): BoatPathSection<T> {
        const placements: Partial<Record<T, ObstaclePlacement[]>> = {};

        // Initialize all potential placement arrays in config
        const allPossibleTypes = new Set<T>([
            ...config.animalPatterns.flatMap(p => p.types),
            ...config.slalomPatterns.flatMap(p => p.types),
            ...config.pathPatterns.flatMap(p => p.types)
        ]);
        for (const type of allPossibleTypes) {
            placements[type] = [];
        }

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

        // Selection
        const selectedAnimalPattern = this.pickWeightedPattern(config.animalPatterns);
        const selectedSlalomPattern = this.pickWeightedPattern(config.slalomPatterns);
        const selectedPathPattern = this.pickWeightedPattern(config.pathPatterns);

        // Apply Layout logic for each category
        this.applyPattern(path, iStart, iEnd, sectionLen, selectedSlalomPattern, placements, config, side, 'slalom', progress);
        this.applyPattern(path, iStart, iEnd, sectionLen, selectedAnimalPattern, placements, config, side, 'animal', progress);
        this.applyPattern(path, iStart, iEnd, sectionLen, selectedPathPattern, placements, config, side, 'path', progress);

        return { iStart, iEnd, placements };
    }

    private static applyPattern<T extends string>(
        path: PathPoint[],
        iStart: number,
        iEnd: number,
        sectionLength: number,
        pattern: SectionPattern<T> | undefined,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        side: 'left' | 'right',
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        if (!pattern) return;

        const d = config.pathDensity.start + progress * (config.pathDensity.end - config.pathDensity.start);
        let expected = (sectionLength / 100) * d;

        if (pattern?.densityMultiplier !== undefined) {
            expected *= pattern.densityMultiplier;
        }

        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (pattern?.minCount !== undefined) count = Math.max(count, pattern.minCount);
        if (pattern?.maxCount !== undefined) count = Math.min(count, pattern.maxCount);

        if (count <= 0) return;

        switch (pattern.logic) {
            case 'scatter':
                this.applyScatter(path, iStart, iEnd, pattern, count, placements, config, side, category, progress);
                break;
            case 'sequence':
                this.applySequence(path, iStart, iEnd, pattern, count, placements, config, side, category, progress);
                break;
            case 'gate':
                this.applyGate(path, iStart, iEnd, pattern, count, placements, config, side, category, progress);
                break;
            case 'staggered':
                this.applyStaggered(path, iStart, iEnd, pattern, count, placements, config, side, category, progress);
                break;
        }
    }

    /**
     * Randomly scatter instances along section and on one side
     */
    private static applyScatter<T extends string>(
        path: PathPoint[],
        iStart: number,
        iEnd: number,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        side: 'left' | 'right',
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = this.randomIndex(iStart, iEnd, j, count);
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const range = this.placementRange(pathPoint, type, side, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    /**
     * Place instances equidistantly along the path on one side
     */
    private static applySequence<T extends string>(
        path: PathPoint[],
        iStart: number,
        iEnd: number,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        side: 'left' | 'right',
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = iStart + (j + 0.5) * (iEnd - iStart) / count;
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const range = this.placementRange(pathPoint, type, side, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    /**
     * Place pairs of instances equidistantly along path and on either
     * side of the path.
     */
    private static applyGate<T extends string>(
        path: PathPoint[],
        iStart: number,
        iEnd: number,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        side: 'left' | 'right',
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        const gateCount = Math.ceil(count / 2);
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = iStart + (Math.floor(j / 2) + 0.5) * (iEnd - iStart) / gateCount;
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const gateSide = (j % 2 === 0) ? side : (side === 'left' ? 'right' : 'left');
            const range = this.placementRange(pathPoint, type, gateSide, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    /**
     * Place instances equidistantly along the path and on alternating
     * sides.
     */
    private static applyStaggered<T extends string>(
        path: PathPoint[],
        iStart: number,
        iEnd: number,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        side: 'left' | 'right',
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = iStart + (j + 0.5) * (iEnd - iStart) / count;
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const staggerSide = (j % 2 === 0) ? side : (side === 'left' ? 'right' : 'left');
            const range = this.placementRange(pathPoint, type, staggerSide, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    /**
     * Returns the placement range for an instance.
     * slalom objects are placed anywhere between the boat path and the bank
     * animals are placed on or close to the bank
     * path objects are placed close to the boat and ignore side
     */
    private static placementRange<T extends string>(
        pathPoint: PathPoint,
        type: T,
        side: 'left' | 'right',
        category: 'slalom' | 'animal' | 'path',
        config: BoatPathLayoutConfig<T>
    ): [number, number] {
        if (category === 'slalom') {
            return side === 'right' ?
                [pathPoint.boatXOffset + 5.0, pathPoint.bankDist - 2.0] :
                [-pathPoint.bankDist + 2.0, pathPoint.boatXOffset - 5.0];
        } else if (category === 'animal') {
            const isWaterAnimal = config.waterAnimals.includes(type);
            if (isWaterAnimal) {
                return side === 'right' ?
                    [0.5 * pathPoint.bankDist, pathPoint.bankDist] :
                    [-pathPoint.bankDist, 0.5 * -pathPoint.bankDist];
            } else {
                return side === 'right' ?
                    [0.5 * pathPoint.bankDist, pathPoint.bankDist + 15] :
                    [-pathPoint.bankDist - 15, 0.5 * -pathPoint.bankDist];
            }
        } else {
            return [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2];
        }
    }

    private static recordPlacement<T extends string>(
        pathIndex: number,
        range: [number, number],
        type: T,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        const aggressiveness = category === 'animal' ?
            Math.min(1.0, progress * 0.7 + Math.random() * 0.3) : undefined;

        if (!placements[type]) placements[type] = [];
        placements[type]!.push({ index: pathIndex, range, aggressiveness });
    }

    private static pickWeightedPattern<T extends string>(patterns: SectionPattern<T>[]): SectionPattern<T> | undefined {
        if (patterns.length === 0) return undefined;
        let totalWeight = 0;
        for (const p of patterns) totalWeight += p.weight;
        if (totalWeight <= 0) return patterns[0];

        let r = Math.random() * totalWeight;
        for (const p of patterns) {
            r -= p.weight;
            if (r <= 0) return p;
        }
        return patterns[patterns.length - 1];
    }

    private static randomIndex(iStart: number, iEnd: number, n: number, count: number) {
        return iStart + (n + Math.random() * 0.99) * (iEnd - iStart) / count;
    }
}
