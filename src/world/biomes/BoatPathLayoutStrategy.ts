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
    minProgress?: number; // 0.0 to 1.0
    maxProgress?: number; // 0.0 to 1.0
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

        // 2. Dynamic Block Formation
        // We now form blocks by picking patterns and then consuming enough sub-sections
        // to satisfy those patterns' requirements.
        const pathLength = path[path.length - 1].arcLength;
        const blocks: LayoutBlock<T>[] = [];

        // Prepare pattern pools
        const animalPool = this.generatePatternPool(config.animalPatterns);
        const slalomPool = this.generatePatternPool(config.slalomPatterns);
        const pathPool = this.generatePatternPool(config.pathPatterns);

        let subIdx = 0;
        const state = {
            lastStaggerSide: 'right' as 'left' | 'right'
        };

        while (subIdx < subSections.length) {
            const blockStartSubIdx = subIdx;
            const blockStartPathIdx = subSections[subIdx].iStart;
            const blockStartArcLen = path[blockStartPathIdx].arcLength;
            const progress = blockStartArcLen / pathLength;

            // Pick patterns that match the current progress
            const animalPattern = this.pickPattern(animalPool, progress);
            const slalomPattern = this.pickPattern(slalomPool, progress);
            const pathPattern = this.pickPattern(pathPool, progress);

            // Determine minimum length needed for these patterns
            const minLen = this.calculateRequiredLength(
                config,
                animalPattern,
                slalomPattern,
                pathPattern,
                progress
            );

            // Consume sub-sections until we meet minLen or hit end
            let currentLen = 0;
            let currentBlockSubSections: BoatPathSection<T>[] = [];

            while (subIdx < subSections.length) {
                const sub = subSections[subIdx];
                currentBlockSubSections.push(sub);
                currentLen = path[sub.iEnd].arcLength - blockStartArcLen;
                subIdx++;

                if (currentLen >= minLen) break;
                // If we are at the last sub-section, we must stop anyway
            }

            if (currentBlockSubSections.length > 0) {
                const block: LayoutBlock<T> = {
                    iStart: blockStartPathIdx,
                    iEnd: currentBlockSubSections[currentBlockSubSections.length - 1].iEnd,
                    subSections: currentBlockSubSections,
                    placements: {}
                };

                // Populate this block immediately so we can pass the patterns we picked
                const populatedBlock = this.populateBlock(
                    path,
                    block,
                    config,
                    animalPattern,
                    slalomPattern,
                    pathPattern,
                    state,
                    progress // Pass progress explicitly
                );
                blocks.push(populatedBlock);
            }
        }

        return { path, sections: blocks };
    }

    private static generatePatternPool<T extends string>(
        patterns: SectionPattern<T>[]
    ): SectionPattern<T>[] {
        if (patterns.length === 0) return [];

        // Create a large enough pool to draw from (e.g. 100 items)
        const pool: SectionPattern<T>[] = [];
        const totalWeight = patterns.reduce((sum, p) => sum + p.weight, 0);
        const poolSize = 100;

        for (const p of patterns) {
            const count = Math.max(1, Math.round((p.weight / totalWeight) * poolSize));
            for (let i = 0; i < count; i++) {
                pool.push(p);
            }
        }

        // Shuffle
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool;
    }

    private static pickPattern<T extends string>(
        pool: SectionPattern<T>[],
        progress: number
    ): SectionPattern<T> | undefined {
        if (pool.length === 0) return undefined;

        // Find first pattern in shuffled pool that satisfies progress
        // We can just iterate linearly since it's already shuffled
        for (let i = 0; i < pool.length; i++) {
            const p = pool[i];
            const min = p.minProgress ?? 0;
            const max = p.maxProgress ?? 1.0;
            if (progress >= min && progress <= max) {
                // To keep it random but not always the same, we could swap it to the end
                // or just return it. For now, let's just return it to keep simplicity.
                return p;
            }
        }

        // Fallback to any pattern if none match progress (shouldn't happen with good config)
        return pool[0];
    }

    private static calculateRequiredLength<T extends string>(
        config: BoatPathLayoutConfig<T>,
        animalPattern: SectionPattern<T> | undefined,
        slalomPattern: SectionPattern<T> | undefined,
        pathPattern: SectionPattern<T> | undefined,
        progress: number
    ): number {
        const calculatePatternMinLen = (p: SectionPattern<T> | undefined, category: 'slalom' | 'animal' | 'path') => {
            if (!p || p.minCount === undefined) return 0;

            const dConfig = category === 'slalom' ? config.slalomDensity :
                category === 'animal' ? config.animalDensity : config.pathDensity;

            const density = dConfig.start + progress * (dConfig.end - dConfig.start);
            if (density <= 0) return 0;

            let required = (p.minCount / (density / 100)); // length = count / (density/100)
            if (p.densityMultiplier !== undefined) {
                required /= p.densityMultiplier;
            }
            return required;
        };

        const lenA = calculatePatternMinLen(animalPattern, 'animal');
        const lenS = calculatePatternMinLen(slalomPattern, 'slalom');
        const lenP = calculatePatternMinLen(pathPattern, 'path');

        const baseMin = config.minSectionLength ?? 100.0;
        return Math.max(baseMin, lenA, lenS, lenP);
    }

    private static populateBlock<T extends string>(
        path: PathPoint[],
        block: LayoutBlock<T>,
        config: BoatPathLayoutConfig<T>,
        animalPattern: SectionPattern<T> | undefined,
        slalomPattern: SectionPattern<T> | undefined,
        pathPattern: SectionPattern<T> | undefined,
        state: { lastStaggerSide: 'left' | 'right' },
        progress: number
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
