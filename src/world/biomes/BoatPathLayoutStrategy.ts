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

export type PatternLogic = 'scatter' | 'sequence' | 'gate' | 'staggered' | 'cluster';
export type PlacementType = 'on-shore' | 'path' | 'slalom' | 'near-shore' | 'middle';

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
    /** Function called at spawn time to get placement parameters */
    options?: SpawnOptionsFn;
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

                    this.resolvePattern(
                        path,
                        config,
                        pattern,
                        [sceneIStart, sceneIEnd],
                        progress,
                        sceneLenMeters,
                        placements
                    );
                }
            }

            // Explicit placements
            for (const ep of track.explicitPlacements) {
                const pathIndex = ep.at * (path.length - 1);
                placements.push(this.applyIndividualPlacement(
                    path,
                    ep.type,
                    ep.place,
                    ep.options,
                    pathIndex,
                    config,
                    { lastStaggerSide: 'right' },
                    ep.at
                ));
            }
        }

        return placements;
    }

    private static resolvePattern(
        path: PathPoint[],
        config: BoatPathLayoutConfig,
        pattern: PatternConfig,
        range: [number, number],        // range of pattern in path
        progress: number,
        length: number,                 // length of pattern
        placements: ObstaclePlacement[]
    ) {
        const density = this.getDensity(pattern, progress);
        const expected = (length / 100) * density;
        let count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);

        if (pattern.minCount !== undefined) count = Math.max(count, pattern.minCount);
        if (pattern.maxCount !== undefined) count = Math.min(count, pattern.maxCount);

        const state = { lastStaggerSide: 'right' as 'left' | 'right' };

        for (let j = 0; j < count; j++) {
            let pathIndex = 0;
            let logic: PatternLogic | undefined = pattern.logic;
            let gateIndex: number | undefined = undefined;

            switch (pattern.logic) {
                case 'scatter':
                    pathIndex = range[0] + Math.random() * (range[1] - range[0]);
                    break;
                case 'sequence':
                    pathIndex = range[0] + (j + 0.5) * (range[1] - range[0]) / count;
                    break;
                case 'staggered':
                    pathIndex = range[0] + (j + 0.5) * (range[1] - range[0]) / count;
                    break;
                case 'gate':
                    const subCount = Math.ceil(count / 2);
                    const step = Math.floor(j / 2);
                    pathIndex = range[0] + (step + 0.5) * (range[1] - range[0]) / subCount;
                    gateIndex = j % 2;
                    break;
                case 'cluster':
                    const center = range[0] + Math.random() * (range[1] - range[0]);
                    const jitter = (Math.random() - 0.5) * 5.0;
                    pathIndex = Math.max(range[0], Math.min(range[1], center + jitter));
                    break;
            }

            placements.push(this.applyIndividualPlacement(
                path,
                pattern.types[Math.floor(Math.random() * pattern.types.length)],
                pattern.place,
                pattern.options,
                pathIndex,
                config,
                state,
                progress,
                logic,
                gateIndex
            ));
        }
    }

    /**
     * Logic for deciding exactly where a single obstacle should be placed.
     * Resolves the side (left/right) relative to the boat path and pattern logic.
     */
    private static applyIndividualPlacement(
        path: PathPoint[],
        type: EntityIds,
        place: PlacementType,
        spawnOptions: SpawnOptionsFn | undefined,
        pathIndex: number,
        config: BoatPathLayoutConfig,
        state: { lastStaggerSide: 'left' | 'right' },
        progress: number,
        logic?: PatternLogic,
        gateIndex?: number
    ): ObstaclePlacement {
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

        return {
            type,
            index: pathIndex,
            range,
            aggressiveness,
            options: spawnOptions
        };
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

    private static getDensity(pattern: PatternConfig, progress: number): number {
        if (pattern.density === undefined) return 1.0;
        return pattern.density[0] + progress * (pattern.density[1] - pattern.density[0]);
    }
}
