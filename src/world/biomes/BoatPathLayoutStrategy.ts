import { EntityIds } from '../../entities/EntityIds';
import { AnimalSpawnOptions } from '../../entities/spawners/AnimalSpawner';
import { RiverGeometry, RiverGeometrySample } from '../RiverGeometry';
import { RiverSystem } from '../RiverSystem';

export type SpawnOptionsFn = (id: EntityIds, inRiver: boolean) => AnimalSpawnOptions;

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
    /** The type of entity to spawn */
    type: EntityIds;
    /** Index + fractional offset in the path array */
    index: number;
    /** Allowed distance range [-bankDist, bankDist] along the normal vector */
    range: [number, number];
    /** Optional behavior scaling for attack animals */
    aggressiveness?: number;
    /** Function called at spawn time to get placement parameters */
    options?: SpawnOptionsFn;
}

/**
 * The final generated boat path and its associated obstacle layout.
 */
export interface BoatPathLayout {
    /** Array of geometry and boat offset samples */
    path: PathPoint[];
    /** Flattened list of obstacle placements */
    placements: ObstaclePlacement[];
}

export type PlacementType = 'on-shore' | 'path' | 'slalom' | 'near-shore' | 'middle';

/** Context passed to the pattern function for generating entity placements
 */
export interface PatternContext {
    placements: ObstaclePlacement[];
    path: PathPoint[];
    config: BoatPathLayoutConfig;
    range: [number, number];        // index range in path array
    progress: number;               // progress [0-1] along river
    length: number;                 // arc length of the segment
}

export type PatternConfig = (context: PatternContext) => void;

export interface CommonPatternOptions {
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
    /** Function called at spawn time to get placement parameters */
    options?: SpawnOptionsFn;
}

export class Patterns {
    public static scatter(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._scatter(context, opts);
    }

    public static sequence(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._sequence(context, opts);
    }

    public static staggered(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._staggered(context, opts);
    }

    public static gate(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._gate(context, opts);
    }

    public static cluster(opts: CommonPatternOptions): PatternConfig {
        return (context: PatternContext) => this._cluster(context, opts);
    }

    private static _scatter(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
            ));
        }
    }

    private static _sequence(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
            ));
        }
    }

    private static _staggered(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const pathIndex = context.range[0] + (j + 0.5) * (context.range[1] - context.range[0]) / count;
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
                j % 2 === 0 ? 'left' : 'right',
            ));
        }
    }

    private static _gate(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const subCount = Math.ceil(count / 2);
            const step = Math.floor(j / 2);
            const pathIndex = context.range[0] + (step + 0.5) * (context.range[1] - context.range[0]) / subCount;
            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex,
                j % 2 === 0 ? 'left' : 'right',
            ));
        }
    }

    private static _cluster(context: PatternContext, opts: CommonPatternOptions) {
        const density = this.getDensity(opts.density, context.progress);
        const expected = (context.length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (opts.minCount !== undefined) count = Math.max(count, opts.minCount);
        if (opts.maxCount !== undefined) count = Math.min(count, opts.maxCount);

        for (let j = 0; j < count; j++) {
            const center = context.range[0] + Math.random() * (context.range[1] - context.range[0]);
            const jitter = (Math.random() - 0.5) * 5.0;
            const pathIndex = Math.max(context.range[0], Math.min(context.range[1], center + jitter));

            context.placements.push(this.applyIndividualPlacement(
                context,
                opts.place,
                opts.types[Math.floor(Math.random() * opts.types.length)],
                opts.options,
                pathIndex
            ));
        }
    }

    public static applyIndividualPlacement(
        context: PatternContext,
        place: PlacementType,
        type: EntityIds,
        spawnOptions: SpawnOptionsFn | undefined,
        pathIndex: number,
        side?: 'left' | 'right'
    ): ObstaclePlacement {
        const pathPoint = RiverGeometry.getPathPoint(context.path, pathIndex);
        if (side === undefined) {
            if (place === 'path') {
                side = 0.5 < Math.random() ? 'left' : 'right';
            } else {
                const boatSide = pathPoint.boatXOffset > 0 ? 'right' : 'left';
                side = boatSide === 'right' ? 'left' : 'right';
            }
        }

        const range = this.placementRange(pathPoint, type, side, place, context.config);
        const aggressiveness = Math.min(1.0, context.progress * 0.7 + Math.random() * 0.3);

        return {
            type,
            index: pathIndex,
            range,
            aggressiveness,
            options: spawnOptions
        };
    }

    public static placementRange(
        pathPoint: PathPoint,
        type: EntityIds,
        side: 'left' | 'right',
        place: PlacementType,
        config: BoatPathLayoutConfig
    ): [number, number] {
        if (place === 'on-shore') {
            return side === 'right' ?
                [pathPoint.bankDist, pathPoint.bankDist + 15] :
                [-pathPoint.bankDist - 15, -pathPoint.bankDist];
        } else if (place === 'slalom') {
            return side === 'right' ?
                [pathPoint.boatXOffset + 5.0, pathPoint.bankDist - 2.0] :
                [-pathPoint.bankDist + 2.0, pathPoint.boatXOffset - 5.0];
        } else if (place === 'near-shore') {
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
        } else if (place === 'middle') {
            return side === 'right' ?
                [0, 0.5 * pathPoint.bankDist] :
                [0.5 * -pathPoint.bankDist, 0];
        } else {
            // path, random position offset by +/-2
            return [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2];
        }
    }

    public static getDensity(density: [number, number] | undefined, progress: number): number {
        if (density === undefined) return 1.0;
        return density[0] + progress * (density[1] - density[0]);
    }
}

/**
 * Configuration for a specific, non-procedural placement on a track.
 */
export interface ExplicitPlacementConfig {
    /** Unique name for this placement */
    name: string;
    /** The obstacle type to spawn */
    type: EntityIds;
    /** Progress [0-1] along the biome length, distance from center to bank [0-1] */
    at: number;
    range: [number, number];
    /** Function called at spawn time to get placement parameters */
    options?: SpawnOptionsFn;
}

export type PatternConfigs = Record<string, PatternConfig>;

export interface SceneConfig {
    /** Length of this scene in meters */
    length: [number, number];
    /** Patterns applied within this scene */
    patterns: string[];
}

/**
 * Defines a segment of a track where certain scenes are laid out.
 */
export interface StageConfig {
    name: string;
    /** The progress range [0.0, 1.0] within the biome where this stage can be selected */
    progress: [number, number];
    /** Scenes to choose from for this stage */
    scenes: SceneConfig[];
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
    /** List of entity types that are considered 'water animals' for 'near-shore' placement */
    waterAnimals: EntityIds[];
    /** Path weaving parameters */
    path: {
        /** [startLength, endLength] of weaving segments */
        length: [number, number];
    };
}

interface CalculatedScene {
    config: SceneConfig;
    sStart: number; // Arc length start
    sEnd: number;   // Arc length end
}

interface GeneratedTrack {
    name: string;
    scenes: CalculatedScene[];
    explicitPlacements: ExplicitPlacementConfig[];
}

/**
 * Strategy class for generating a procedural boat path and its associated obstacle layout.
 * Uses a track-based system where multiple independent tracks contribute to the final distribution.
 */
export class BoatPathLayoutStrategy {
    public static createLayout(
        zMin: number,
        zMax: number,
        config: BoatPathLayoutConfig
    ): BoatPathLayout {
        // 1. Sample the river
        const path = this.sampleRiver(zMax, zMin);
        if (path.length < 2) return { path, placements: [] };

        const totalArcLength = path[path.length - 1].arcLength;

        // 2. Generate each track
        const tracks = this.generateTracks(config, totalArcLength);

        // 3. Generate the boat path (weaving)
        this.generateWeavingPath(path, config, totalArcLength);

        // 4. Determine obstacle placements
        const placements = this.resolvePlacements(path, tracks, config, totalArcLength);

        return { path, placements };
    }

    private static sampleRiver(zStart: number, zEnd: number): PathPoint[] {
        const riverSystem = RiverSystem.getInstance();
        return RiverGeometry.sampleRiver(riverSystem, zStart, zEnd, 10.0).map((sample) => {
            return { ...sample, boatXOffset: 0 };
        });
    }

    private static generateTracks(config: BoatPathLayoutConfig, totalArcLength: number): GeneratedTrack[] {
        const generatedTracks: GeneratedTrack[] = [];

        for (const track of config.tracks) {
            const scenes: CalculatedScene[] = [];
            if (track.stages) {
                for (const stage of track.stages) {
                    const stageArcStart = stage.progress[0] * totalArcLength;
                    const stageArcEnd = stage.progress[1] * totalArcLength;
                    const stageArcLength = stageArcEnd - stageArcStart;

                    if (stageArcLength <= 0) continue;

                    const stageScenes: CalculatedScene[] = [];
                    let currentStageArc = 0;
                    const shuffledScenes = [...stage.scenes].sort(() => Math.random() - 0.5);
                    let sceneIdx = 0;

                    while (currentStageArc < stageArcLength) {
                        const sceneConfig = shuffledScenes[sceneIdx % shuffledScenes.length];
                        sceneIdx++;

                        const len = sceneConfig.length[0] + Math.random() * (sceneConfig.length[1] - sceneConfig.length[0]);
                        stageScenes.push({
                            config: sceneConfig,
                            sStart: currentStageArc,
                            sEnd: currentStageArc + len
                        });
                        currentStageArc += len;
                    }

                    // Scale
                    const scale = stageArcLength / currentStageArc;
                    for (const s of stageScenes) {
                        s.sStart = stageArcStart + s.sStart * scale;
                        s.sEnd = stageArcStart + s.sEnd * scale;
                        scenes.push(s);
                    }
                }
            }

            generatedTracks.push({
                name: track.name,
                scenes,
                explicitPlacements: track.placements || []
            });
        }

        return generatedTracks;
    }

    private static generateWeavingPath(path: PathPoint[], config: BoatPathLayoutConfig, totalArcLength: number) {
        if (path.length < 2) return;

        let currentArc = 0;
        let side = 1;

        while (currentArc < totalArcLength) {
            const progress = currentArc / totalArcLength;
            const segmentLen = config.path.length[0] + progress * (config.path.length[1] - config.path.length[0]);
            const nextArc = Math.min(totalArcLength, currentArc + segmentLen);

            // Apply weaving to points in [currentArc, nextArc]
            for (const p of path) {
                if (p.arcLength >= currentArc && p.arcLength <= nextArc) {
                    const segmentProgress = (p.arcLength - currentArc) / (nextArc - currentArc);
                    const normalizedX = Math.sin(segmentProgress * Math.PI) * side * 0.7;

                    const margin = 5.0;
                    const width = p.bankDist - margin;
                    p.boatXOffset = normalizedX * width;
                }
            }

            currentArc = nextArc;
            side *= -1;
        }
    }

    private static resolvePlacements(
        path: PathPoint[],
        tracks: GeneratedTrack[],
        config: BoatPathLayoutConfig,
        totalArcLength: number
    ): ObstaclePlacement[] {
        const placements: ObstaclePlacement[] = [];

        for (const track of tracks) {
            // Procedural scenes
            for (const scene of track.scenes) {
                const sceneLenMeters = scene.sEnd - scene.sStart;

                for (const patternName of scene.config.patterns) {
                    const pattern = config.patterns[patternName];
                    if (!pattern) continue;

                    const progress = (scene.sStart + scene.sEnd) / (2 * totalArcLength);
                    const sceneIStart = Math.floor((scene.sStart / totalArcLength) * (path.length - 1));
                    const sceneIEnd = Math.floor((scene.sEnd / totalArcLength) * (path.length - 1));

                    const context: PatternContext = {
                        placements,
                        path,
                        config,
                        range: [sceneIStart, sceneIEnd],
                        progress,
                        length: sceneLenMeters
                    };
                    pattern(context);
                }
            }

            // Explicit placements
            for (const ep of track.explicitPlacements) {
                const pathIndex = ep.at * (path.length - 1);
                const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);

                // determine placement range on wide side of path
                let range: [number, number] = [0, 0];
                if (pathPoint.boatXOffset < 0) {
                    const width = pathPoint.bankDist - pathPoint.boatXOffset;
                    range[0] = pathPoint.boatXOffset + width * ep.range[0];
                    range[1] = pathPoint.boatXOffset + width * ep.range[1];
                } else {
                    const width = pathPoint.bankDist + pathPoint.boatXOffset;
                    range[0] = pathPoint.boatXOffset - width * ep.range[0];
                    range[1] = pathPoint.boatXOffset - width * ep.range[1];
                }

                const aggressiveness = Math.min(1.0, ep.at * 0.7 + Math.random() * 0.3);

                placements.push({
                    index: pathIndex,
                    type: ep.type,
                    range,
                    aggressiveness,
                    options: ep.options
                });
            }
        }

        return placements;
    }
}
