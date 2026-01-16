import { EntityIds } from '../../entities/EntityIds';
import { RiverGeometry, RiverGeometrySample } from '../RiverGeometry';
import { RiverSystem } from '../RiverSystem';

/**
 * Represents a point on the boat path, extending the basic river geometry
 * with a boat-specific X offset for weaving.
 */
export interface PathPoint extends RiverGeometrySample {
    /** Offset from river center along the normal vector (negative is left, positive is right) */
    boatXOffset: number;
}

/**
 * Details for placing a single obstacle instance along the boat path.
 */
export interface ObstaclePlacement {
    /** Index + fractional offset in the path array */
    index: number;
    /** Allowed distance range [-bankDist, bankDist] along the normal vector */
    range: [number, number];
    /** Optional behavior scaling for attack animals */
    aggressiveness?: number;
}

/**
 * A block of the layout, grouping multiple path segments (sub-sections).
 */
export interface LayoutBlock {
    /** Starting global path index of this block */
    iStart: number;
    /** Ending global path index of this block */
    iEnd: number;
    /** Map of entity types to their specific placements within this block */
    placements: Partial<Record<EntityIds, ObstaclePlacement[]>>;
}

/**
 * The final generated boat path and its associated obstacle layout sections.
 */
export interface BoatPathLayout {
    /** Array of geometry and boat offset samples */
    path: PathPoint[];
    /** Sequential blocks of placements */
    sections: LayoutBlock[];
}

export type PatternLogic = 'scatter' | 'sequence' | 'gate' | 'staggered' | 'cluster';
export type PlacementType = 'path' | 'slalom' | 'shore';

/**
 * Configuration for a single behavioral pattern of obstacle placement.
 */
export interface PatternConfig {
    /** Distribution logic (scattered, ordered, etc.) */
    logic: PatternLogic;
    /** Target area (near path, across river, or on shore) */
    place: PlacementType;
    /** Min and Max density in instances per 100m. Scales from start to end of biome. */
    density?: [number, number];
    /** Candidate obstacle types for this pattern */
    types: EntityIds[];
    /** Minimum required instances */
    minCount?: number;
    /** Maximum allowed instances */
    maxCount?: number;
}

export type PatternConfigs = Record<string, PatternConfig>;

export interface PatternChoice {
    pattern: string; // Name of the pattern
    weight: number;
    at?: number[]; // Explicit progress locations [0-1]
}

/**
 * Defines a segment of a track where certain patterns apply.
 */
export interface StageConfig {
    name: string;
    /** The progress range [0.0, 1.0] within the biome where this stage can be selected */
    progress: [number, number];
    /** A set of pattern choices. One pattern is chosen from each inner array at random based on weights. */
    patterns: PatternChoice[][];
}

/**
 * Configuration for a specific, non-procedural placement on a track.
 */
export interface ExplicitPlacementConfig {
    /** Unique name for this placement */
    name: string;
    /** Area for placement (path, slalom, shore) */
    place: PlacementType;
    /** Progress [0-1] along the biome length */
    at: number;
    /** The obstacle type to spawn */
    type: EntityIds;
}

/**
 * Defines a track which can either be a sequence of procedural stages
 * or a collection of explicit, unique placements.
 */
export interface TrackConfig {
    name: string;
    /** Procedural stages that fill the biome length (optional if placements is used) */
    stages?: StageConfig[];
    /** Explicit, unique placements at specific progress points (optional if stages is used) */
    placements?: ExplicitPlacementConfig[];
}

/**
 * Top-level configuration for the BoatPathLayoutStrategy and Biome features.
 */
export interface BoatPathLayoutConfig {
    /** Record of all named pattern configurations available in this biome */
    patterns: PatternConfigs;
    /** Array of tracks. Each track generates stages independently to fill the biome. */
    tracks: TrackConfig[];
    /** List of entity types that are considered 'water animals' for shore placement refinement */
    waterAnimals: EntityIds[];
}

interface CalculatedStage {
    config: StageConfig;
    patterns: PatternConfig[];
    patternAts: (number[] | undefined)[];
    pStart: number;
    pEnd: number;
}

/**
 * Strategy class for generating a procedural boat path and its associated obstacle layout.
 * Uses a track-based system where multiple independent tracks contribute to the final distribution.
 */
export class BoatPathLayoutStrategy {
    /**
     * The main entry point for layout generation.
     * 1. Samples river geometry.
     * 2. Independently scales and generates stages for each configured track.
     * 3. Generates a sinusoidal weaving boat path based on the primary track's boundaries.
     * 4. Merges all track placements into layout blocks.
     */
    public static createLayout(
        zMin: number,
        zMax: number,
        config: BoatPathLayoutConfig
    ): BoatPathLayout {
        const riverSystem = RiverSystem.getInstance();

        // Direction of travel is -ve z
        const zStart = zMax;
        const zEnd = zMin;

        // 1. Sample the river first to get the total arc length
        const path: PathPoint[] = RiverGeometry.sampleRiver(riverSystem, zStart, zEnd, 10.0).map((sample) => {
            return { ...sample, boatXOffset: 0 }; // Temporarily 0, will update below
        });

        if (path.length < 2) return { path, sections: [] };

        const totalArcLength = path[path.length - 1].arcLength;

        // 2. Generate tracks independently
        const trackPlacements: { trackName: string, stages: CalculatedStage[] }[] = [];
        for (const track of config.tracks) {
            const stages = this.generateTrackStages(track, config, totalArcLength);
            trackPlacements.push({ trackName: track.name, stages });
        }

        // 3. Determine boat path crossings based on Track 0 stage boundaries
        const track0 = trackPlacements[0];
        const crossings: number[] = [0]; // progress values [0-1]
        if (track0) {
            for (let i = 0; i < track0.stages.length - 1; i++) {
                crossings.push(track0.stages[i].pEnd);
            }
        }
        crossings.push(1.0);

        // 4. Update path points with weaving boatXOffset
        for (const p of path) {
            const progress = p.arcLength / totalArcLength;

            // Find which crossing segment we are in
            let segmentIdx = 0;
            for (let i = 0; i < crossings.length - 1; i++) {
                if (progress >= crossings[i] && progress <= crossings[i + 1]) {
                    segmentIdx = i;
                    break;
                }
            }

            // Weave back and forth
            const side = (segmentIdx % 2 === 0) ? 1 : -1;
            const segmentProgress = (progress - crossings[segmentIdx]) / (crossings[segmentIdx + 1] - crossings[segmentIdx]);

            // Sinusoidal weave within segment
            const normalizedX = Math.sin(segmentProgress * Math.PI) * side * 0.7;

            const margin = 5.0;
            const width = p.bankDist - margin;
            p.boatXOffset = normalizedX * width;
        }

        // 5. Form LayoutBlocks by merging all track placements
        const blocks: LayoutBlock[] = [];

        // For simplicity, we create one block per track stage if they don't overlap too much,
        // but since tracks are independent, it's better to just collect all placements.
        // Let's create a single large block for now, or split by some constant interval.
        // Actually, the original design had 'sections', let's just make one block for the whole biome
        // and populate it from all tracks. Or better, split it into chunks for performance/paging if needed.
        // For now, let's keep it simple: One block per track 0 stage.

        for (let i = 0; i < crossings.length - 1; i++) {
            const pStart = crossings[i];
            const pEnd = crossings[i + 1];

            const iStart = Math.floor(pStart * (path.length - 1));
            const iEnd = Math.floor(pEnd * (path.length - 1));

            const block: LayoutBlock = {
                iStart,
                iEnd,
                placements: {}
            };

            // Populate placements from all tracks that overlap this progress range
            for (const tp of trackPlacements) {
                // Procedural stages
                for (const stage of tp.stages) {
                    if (stage.pEnd <= pStart || stage.pStart >= pEnd) continue;

                    // Apply patterns for this stage
                    this.populatePlacements(path, block, stage, config, totalArcLength);
                }
            }

            // Populate explicit placements from tracks
            for (const track of config.tracks) {
                if (track.placements) {
                    for (const ep of track.placements) {
                        if (ep.at >= pStart && ep.at < pEnd) {
                            const pathIndex = ep.at * (path.length - 1);
                            const state = { lastStaggerSide: 'right' as 'left' | 'right' };
                            this.applyIndividualPlacement(
                                path,
                                block,
                                ep.type,
                                ep.place,
                                pathIndex,
                                config,
                                state,
                                ep.at
                            );
                        }
                    }
                }
            }

            blocks.push(block);
        }

        return { path, sections: blocks };
    }

    /**
     * Generates a sequence of stages for a track to fill the biome.
     * Each stage is randomly chosen from applicable stage configs and scaled
     * so it reaches the end of the biome.
     */
    private static generateTrackStages(
        track: TrackConfig,
        config: BoatPathLayoutConfig,
        totalArcLength: number
    ): CalculatedStage[] {
        const stages: CalculatedStage[] = [];
        if (!track.stages) return stages;

        let currentProgress = 0;

        while (currentProgress < 1.0) {
            // 2. Choose at random a stage that is applicable
            const applicableStages = track.stages.filter(s =>
                currentProgress >= s.progress[0] && currentProgress <= s.progress[1]
            );

            if (applicableStages.length === 0) {
                // Advance until one is available
                const nextStage = track.stages.find(s => s.progress[0] > currentProgress);
                if (!nextStage) break;
                currentProgress = nextStage.progress[0];
                continue;
            }

            // Shuffle and pick
            const stageConfig = applicableStages[Math.floor(Math.random() * applicableStages.length)];

            // 3. Choose one pattern from each set
            const chosenPatterns: PatternConfig[] = [];
            const chosenAts: (number[] | undefined)[] = [];

            for (const set of stageConfig.patterns) {
                const choice = this.weightedPickFromArray(set);
                chosenPatterns.push(config.patterns[choice.pattern]);
                chosenAts.push(choice.at);
            }

            // 4. Determine the range of minimum lengths
            let Lmin = Infinity;
            let Lmax = -Infinity;

            for (const p of chosenPatterns) {
                const density = this.getDensity(p, currentProgress);
                const minCount = p.minCount ?? 1;
                const len = (minCount / (density / 100));
                Lmin = Math.min(Lmin, len);
                Lmax = Math.max(Lmax, len);
            }

            if (Lmin === Infinity) Lmin = 50; // Fallback
            if (Lmax === -Infinity) Lmax = 100;

            const chosenLen = Lmax + Math.random() * (Math.max(2 * Lmin, Lmax) - Lmax);
            const progressLen = chosenLen / totalArcLength;

            stages.push({
                config: stageConfig,
                patterns: chosenPatterns,
                patternAts: chosenAts,
                pStart: currentProgress,
                pEnd: currentProgress + progressLen
            });

            currentProgress += progressLen;
        }

        // 5. Scale to fit intended range
        if (stages.length > 0) {
            const firstStage = stages[0];
            const lastStage = stages[stages.length - 1];

            const initialStart = firstStage.pStart;
            const generatedEnd = lastStage.pEnd;
            const targetEnd = lastStage.config.progress[1];

            const generatedDuration = generatedEnd - initialStart;
            const targetDuration = targetEnd - initialStart;

            if (generatedDuration > 0 && targetDuration > 0) {
                const scale = targetDuration / generatedDuration;
                for (const s of stages) {
                    s.pStart = initialStart + (s.pStart - initialStart) * scale;
                    s.pEnd = initialStart + (s.pEnd - initialStart) * scale;
                }
            }
        }

        return stages;
    }

    private static weightedPickFromArray(choices: PatternChoice[]): PatternChoice {
        const totalWeight = choices.reduce((sum, c) => sum + c.weight, 0);
        let r = Math.random() * totalWeight;
        for (const c of choices) {
            r -= c.weight;
            if (r <= 0) return c;
        }
        return choices[0];
    }

    /**
     * Populates a layout block with placements generated for a specific track stage.
     * Handles pattern logic (scatter, sequence, etc.) and density-based counts.
     */
    private static populatePlacements(
        path: PathPoint[],
        block: LayoutBlock,
        stage: CalculatedStage,
        config: BoatPathLayoutConfig,
        totalArcLength: number
    ) {
        const stageProgress = (stage.pStart + stage.pEnd) / 2;

        for (let i = 0; i < stage.patterns.length; i++) {
            const pattern = stage.patterns[i];
            const explicitAt = stage.patternAts[i];

            const density = this.getDensity(pattern, stageProgress);
            const blockLenProgress = stage.pEnd - stage.pStart;
            const blockLenMeters = blockLenProgress * totalArcLength;

            let expected = (blockLenMeters / 100) * density;
            let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

            if (pattern.minCount !== undefined) count = Math.max(count, pattern.minCount);
            if (pattern.maxCount !== undefined) count = Math.min(count, pattern.maxCount);

            if (count <= 0) continue;

            const state = { lastStaggerSide: 'right' as 'left' | 'right' };

            // Determine indices within the global path
            const iStart = Math.floor(stage.pStart * (path.length - 1));
            const iEnd = Math.floor(stage.pEnd * (path.length - 1));

            if (explicitAt) {
                // Use explicit locations
                for (const p of explicitAt) {
                    const pathIndex = iStart + p * (iEnd - iStart);
                    this.applyIndividualPlacement(
                        path,
                        block,
                        pattern.types[Math.floor(Math.random() * pattern.types.length)],
                        pattern.place,
                        pathIndex,
                        config,
                        state,
                        stageProgress
                    );
                }
            } else {
                // Use patterned logic
                switch (pattern.logic) {
                    case 'scatter':
                        for (let j = 0; j < count; j++) {
                            const pathIndex = iStart + Math.random() * (iEnd - iStart);
                            this.applyIndividualPlacement(
                                path,
                                block,
                                pattern.types[Math.floor(Math.random() * pattern.types.length)],
                                pattern.place,
                                pathIndex,
                                config,
                                state,
                                stageProgress
                            );
                        }
                        break;
                    case 'sequence':
                        for (let j = 0; j < count; j++) {
                            const pathIndex = iStart + (j + 0.5) * (iEnd - iStart) / count;
                            this.applyIndividualPlacement(
                                path,
                                block,
                                pattern.types[Math.floor(Math.random() * pattern.types.length)],
                                pattern.place,
                                pathIndex,
                                config,
                                state,
                                stageProgress
                            );
                        }
                        break;
                    case 'staggered':
                    case 'gate':
                        const subCount = pattern.logic === 'gate' ? Math.ceil(count / 2) : count;
                        for (let j = 0; j < count; j++) {
                            const step = pattern.logic === 'gate' ? Math.floor(j / 2) : j;
                            const pathIndex = iStart + (step + 0.5) * (iEnd - iStart) / subCount;
                            this.applyIndividualPlacement(
                                path,
                                block,
                                pattern.types[Math.floor(Math.random() * pattern.types.length)],
                                pattern.place,
                                pathIndex,
                                config,
                                state,
                                stageProgress,
                                pattern.logic,
                                j % 2
                            );
                        }
                        break;
                    case 'cluster':
                        const center = iStart + Math.random() * (iEnd - iStart);
                        for (let j = 0; j < count; j++) {
                            const jitter = (Math.random() - 0.5) * 5.0; // +/- 50m appx at 10m steps? wait path is 10m
                            const pathIndex = Math.max(iStart, Math.min(iEnd, center + jitter));
                            this.applyIndividualPlacement(
                                path,
                                block,
                                pattern.types[Math.floor(Math.random() * pattern.types.length)],
                                pattern.place,
                                pathIndex,
                                config,
                                state,
                                stageProgress
                            );
                        }
                        break;
                }
            }
        }
    }

    /**
     * Logic for deciding exactly where a single obstacle should be placed.
     * Resolves the side (left/right) relative to the boat path and pattern logic.
     * Picks a random obstacle type from the pattern.
     */
    private static applyIndividualPlacement(
        path: PathPoint[],
        block: LayoutBlock,
        type: EntityIds,
        place: PlacementType,
        pathIndex: number,
        config: BoatPathLayoutConfig,
        state: { lastStaggerSide: 'left' | 'right' },
        progress: number,
        logic?: PatternLogic,
        gateIndex?: number
    ) {
        const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);
        const boatSide = pathPoint.boatXOffset > 0 ? 'right' : 'left';

        let side: 'left' | 'right';

        if (place === 'path') {
            side = Math.random() > 0.5 ? 'left' : 'right';
        } else if (logic === 'staggered') {
            state.lastStaggerSide = state.lastStaggerSide === 'left' ? 'right' : 'left';
            side = state.lastStaggerSide;
        } else if (logic === 'gate') {
            if (gateIndex === 0) {
                side = boatSide === 'right' ? 'left' : 'right'; // opposite to boat
            } else {
                side = boatSide === 'right' ? 'right' : 'left'; // same as boat
            }
        } else {
            // Default: opposite to boat
            side = boatSide === 'right' ? 'left' : 'right';
        }

        const range = this.placementRange(pathPoint, type, side, place, config);

        const aggressiveness = Math.min(1.0, progress * 0.7 + Math.random() * 0.3);

        if (!block.placements[type]) block.placements[type] = [];
        block.placements[type]!.push({ index: pathIndex, range, aggressiveness });
    }

    /**
     * Calculates the world-coordinate offset range along the normal vector
     * for a given placement type and side.
     */
    private static placementRange(
        pathPoint: PathPoint,
        type: EntityIds,
        side: 'left' | 'right',
        place: PlacementType,
        config: BoatPathLayoutConfig
    ): [number, number] {
        if (place === 'slalom') {
            return side === 'right' ?
                [pathPoint.boatXOffset + 5.0, pathPoint.bankDist - 2.0] :
                [-pathPoint.bankDist + 2.0, pathPoint.boatXOffset - 5.0];
        } else if (place === 'shore') {
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
            // path, random position offset by +/-2
            return [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2];
        }
    }

    private static getDensity(pattern: PatternConfig, progress: number): number {
        if (pattern.density === undefined) return 1.0;
        return pattern.density[0] + progress * (pattern.density[1] - pattern.density[0]);
    }
}
