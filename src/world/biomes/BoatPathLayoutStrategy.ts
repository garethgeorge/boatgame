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
    side: 'left' | 'right';
}

export interface LayoutBlock<T extends string> {
    iStart: number;
    iEnd: number;
    subSections: BoatPathSection<T>[];
    placements: Partial<Record<T, ObstaclePlacement[]>>;
}

export interface BoatPathLayout<T extends string> {
    path: PathPoint[];
    sections: LayoutBlock<T>[];
}

export interface DensityConfig {
    start: number; // expected instances per 100m
    end: number;   // expected instances per 100m
}

export interface SectionPattern<T extends string> {
    name: string;
    weight: number;
    logic: 'scatter' | 'sequence' | 'gate' | 'staggered' | 'cluster';
    types: T[];
    densityMultiplier?: number;
    minCount?: number;
    maxCount?: number;
}

/**
 * Densities are instances per 100 m
 */
export interface BoatPathLayoutConfig<T extends string> {
    animalPatterns: SectionPattern<T>[];
    slalomPatterns: SectionPattern<T>[];
    pathPatterns: SectionPattern<T>[];
    waterAnimals: T[];
    slalomDensity: DensityConfig;
    animalDensity: DensityConfig;
    pathDensity: DensityConfig;
    biomeLength: number;
    minSectionLength?: number;
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

        // Sample the river
        const path: PathPoint[] = RiverGeometry.sampleRiver(riverSystem, zStart, zEnd, 10.0).map((sample) => {
            const arcLength = sample.arcLength;
            const wavelength = 400 - (arcLength / config.biomeLength) * 280;
            const baseFreq = (2 * Math.PI) / wavelength;
            const detailFreq = baseFreq * 2.5;

            const normalizedX = Math.sin(arcLength * baseFreq) * 0.6 +
                Math.sin(arcLength * detailFreq) * 0.15;

            const margin = 5.0;
            const width = sample.bankDist - margin;
            const boatXOffset = normalizedX * width;

            return { ...sample, boatXOffset };
        });

        // 1. Identify sub-sections first (crossing points)
        const subSections: BoatPathSection<T>[] = [];
        let subStartIdx = 0;

        for (let i = 1; i < path.length; i++) {
            const prevSide = path[i - 1].boatXOffset > 0;
            const currSide = path[i].boatXOffset > 0;

            if (prevSide !== currSide || i === path.length - 1) {
                if (i - subStartIdx > 2) {
                    const midIdx = Math.floor((subStartIdx + i) / 2);
                    const boatIsOnRight = path[midIdx].boatXOffset > 0;
                    const targetSide = boatIsOnRight ? 'left' : 'right' as 'left' | 'right';
                    subSections.push({ iStart: subStartIdx, iEnd: i, side: targetSide });
                }
                subStartIdx = i;
            }
        }

        // 2. Group sub-sections into LayoutBlocks based on minSectionLength
        const minLen = config.minSectionLength ?? 100.0;
        const blocks: LayoutBlock<T>[] = [];
        let currentBlockSubSections: BoatPathSection<T>[] = [];
        let currentBlockLen = 0;

        for (const sub of subSections) {
            currentBlockSubSections.push(sub);
            currentBlockLen += path[sub.iEnd].arcLength - path[sub.iStart].arcLength;

            if (currentBlockLen >= minLen) {
                blocks.push({
                    iStart: currentBlockSubSections[0].iStart,
                    iEnd: sub.iEnd,
                    subSections: currentBlockSubSections,
                    placements: {}
                });
                currentBlockSubSections = [];
                currentBlockLen = 0;
            }
        }

        // Last block if any
        if (currentBlockSubSections.length > 0) {
            if (blocks.length > 0) {
                // Merge with previous block
                const lastBlock = blocks[blocks.length - 1];
                lastBlock.iEnd = currentBlockSubSections[currentBlockSubSections.length - 1].iEnd;
                lastBlock.subSections.push(...currentBlockSubSections);
            } else {
                blocks.push({
                    iStart: currentBlockSubSections[0].iStart,
                    iEnd: currentBlockSubSections[currentBlockSubSections.length - 1].iEnd,
                    subSections: currentBlockSubSections,
                    placements: {}
                });
            }
        }

        // 3. Generate deterministic shuffled queues for patterns per block
        const numBlocks = blocks.length;
        const animalQueue = this.generatePatternQueue(config.animalPatterns, numBlocks);
        const slalomQueue = this.generatePatternQueue(config.slalomPatterns, numBlocks);
        const pathQueue = this.generatePatternQueue(config.pathPatterns, numBlocks);

        // 4. Populate blocks using queues and tracking state
        const state = {
            lastStaggerSide: 'right' as 'left' | 'right'
        };

        const resultSections: LayoutBlock<T>[] = blocks.map((block, idx) => {
            return this.populateBlock(
                path,
                block,
                config,
                animalQueue[idx],
                slalomQueue[idx],
                pathQueue[idx],
                state
            );
        });

        return { path, sections: resultSections };
    }

    private static generatePatternQueue<T extends string>(
        patterns: SectionPattern<T>[],
        count: number
    ): (SectionPattern<T> | undefined)[] {
        if (patterns.length === 0) return Array(count).fill(undefined);

        const totalWeight = patterns.reduce((sum, p) => sum + p.weight, 0);
        if (totalWeight <= 0) return Array(count).fill(patterns[0]);

        const queue: (SectionPattern<T> | undefined)[] = [];

        // Allocate patterns based on weighted proportion
        let allocatedCount = 0;
        for (let i = 0; i < patterns.length; i++) {
            const p = patterns[i];
            const pCount = i === patterns.length - 1
                ? count - allocatedCount
                : Math.round((p.weight / totalWeight) * count);

            for (let j = 0; j < pCount; j++) {
                queue.push(p);
            }
            allocatedCount += pCount;
        }

        // Shuffle the queue (Fisher-Yates)
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        return queue;
    }

    private static populateBlock<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        config: BoatPathLayoutConfig<T>,
        animalPattern: SectionPattern<T> | undefined,
        slalomPattern: SectionPattern<T> | undefined,
        pathPattern: SectionPattern<T> | undefined,
        state: { lastStaggerSide: 'left' | 'right' }
    ): LayoutBlock<T> {
        const placements: Partial<Record<T, ObstaclePlacement[]>> = {};

        // Initialize all potential placement arrays in config
        const allPossibleTypes = new Set<T>([
            ...(animalPattern ? animalPattern.types : []),
            ...(slalomPattern ? slalomPattern.types : []),
            ...(pathPattern ? pathPattern.types : [])
        ]);
        for (const type of allPossibleTypes) {
            placements[type] = [];
        }

        const pathLength = path[path.length - 1].arcLength;
        const pathCutoff = 0.9 * pathLength;
        const blockStart = path[block.iStart].arcLength;
        const blockEnd = Math.min(path[block.iEnd].arcLength, pathCutoff);
        const blockLen = blockEnd - blockStart;

        if (blockLen <= 0) {
            block.placements = placements;
            return block;
        }

        // Use mid point of block as progress along path
        const progress = 0.5 * (blockStart + blockEnd) / pathLength;

        // Apply Layout logic for each category
        this.applyPattern(path, block, blockLen, slalomPattern, placements, config, 'slalom', progress, state);
        this.applyPattern(path, block, blockLen, animalPattern, placements, config, 'animal', progress, state);
        this.applyPattern(path, block, blockLen, pathPattern, placements, config, 'path', progress, state);

        block.placements = placements;
        return block;
    }

    private static applyPattern<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        blockLength: number,
        pattern: SectionPattern<T> | undefined,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        category: 'slalom' | 'animal' | 'path',
        progress: number,
        state: { lastStaggerSide: 'left' | 'right' }
    ) {
        if (!pattern) return;

        const dConfig = category === 'slalom' ? config.slalomDensity :
            category === 'animal' ? config.animalDensity : config.pathDensity;

        const d = dConfig.start + progress * (dConfig.end - dConfig.start);
        let expected = (blockLength / 100) * d;

        if (pattern.densityMultiplier !== undefined) {
            expected *= pattern.densityMultiplier;
        }

        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (pattern.minCount !== undefined) count = Math.max(count, pattern.minCount);
        if (pattern.maxCount !== undefined) count = Math.min(count, pattern.maxCount);

        if (count <= 0) return;

        switch (pattern.logic) {
            case 'scatter':
                this.applyScatter(path, block, pattern, count, placements, config, category, progress);
                break;
            case 'sequence':
                this.applySequence(path, block, pattern, count, placements, config, category, progress);
                break;
            case 'gate':
                this.applyGate(path, block, pattern, count, placements, config, category, progress);
                break;
            case 'staggered':
                this.applyStaggered(path, block, pattern, count, placements, config, category, progress, state);
                break;
            case 'cluster':
                this.applyCluster(path, block, pattern, count, placements, config, category, progress);
                break;
        }
    }

    /**
     * Randomly scatter instances along block and resolve side
     */
    private static applyScatter<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = this.randomIndex(block.iStart, block.iEnd, j, count);
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const side = this.resolveSide(block, pathIndex);
            const range = this.placementRange(pathPoint, type, side, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    /**
     * Place instances equidistantly along the block and resolve side
     */
    private static applySequence<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = block.iStart + (j + 0.5) * (block.iEnd - block.iStart) / count;
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const side = this.resolveSide(block, pathIndex);
            const range = this.placementRange(pathPoint, type, side, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    /**
     * Place pairs of instances equidistantly along block and resolve side
     */
    private static applyGate<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        const gateCount = Math.ceil(count / 2);
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = block.iStart + (Math.floor(j / 2) + 0.5) * (block.iEnd - block.iStart) / gateCount;
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const subSide = this.resolveSide(block, pathIndex);
            const gateSide = (j % 2 === 0) ? subSide : (subSide === 'left' ? 'right' : 'left');
            const range = this.placementRange(pathPoint, type, gateSide, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    /**
     * Place instances equidistantly along the block and on alternating
     * sides.
     */
    private static applyStaggered<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        category: 'slalom' | 'animal' | 'path',
        progress: number,
        state: { lastStaggerSide: 'left' | 'right' }
    ) {
        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];
            const pathIndex = block.iStart + (j + 0.5) * (block.iEnd - block.iStart) / count;
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            // Flip side based on tracker
            state.lastStaggerSide = state.lastStaggerSide === 'left' ? 'right' : 'left';
            const range = this.placementRange(pathPoint, type, state.lastStaggerSide, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    private static applyCluster<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        pattern: SectionPattern<T>,
        count: number,
        placements: Partial<Record<T, ObstaclePlacement[]>>,
        config: BoatPathLayoutConfig<T>,
        category: 'slalom' | 'animal' | 'path',
        progress: number
    ) {
        // Find a center for the cluster
        const clusterCenterIndex = block.iStart + Math.random() * (block.iEnd - block.iStart);

        for (let j = 0; j < count; j++) {
            const type = pattern.types[Math.floor(Math.random() * pattern.types.length)];

            // Tight path index jitter around center
            const jitter = (Math.random() - 0.5) * 2.0; // +/- 1 path point appx
            const pathIndex = Math.max(block.iStart, Math.min(block.iEnd, clusterCenterIndex + jitter));
            const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

            const side = this.resolveSide(block, pathIndex);
            const range = this.placementRange(pathPoint, type, side, category, config);

            this.recordPlacement(pathIndex, range, type, placements, category, progress);
        }
    }

    private static resolveSide<T extends string>(block: LayoutBlock<T>, pathIndex: number): 'left' | 'right' {
        // Find which subsection this pathIndex falls into
        for (const sub of block.subSections) {
            if (pathIndex >= sub.iStart && pathIndex <= sub.iEnd) {
                return sub.side;
            }
        }
        // Fallback to the first subsection's side if it's somehow out of bounds
        return block.subSections[0]?.side ?? 'right';
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

    private static randomIndex(iStart: number, iEnd: number, n: number, count: number) {
        return iStart + (n + Math.random() * 0.99) * (iEnd - iStart) / count;
    }
}
