import { EntityIds } from '../../../entities/EntityIds';
import { RiverGeometry, RiverGeometrySample } from '../../RiverGeometry';
import { RiverSystem } from '../../RiverSystem';
import { EntityGeneratorFn, EntityPlacement, Habitat, PathPoint } from './EntityLayoutRules';
import { SpatialGrid } from '../../../managers/SpatialGrid';
import { PlacementConfig } from './BoatPathLayoutPatterns';

/**
 * The final generated boat path and its associated obstacle layout.
 */
export interface BoatPathLayout {
    /** Array of geometry and boat offset samples */
    path: PathPoint[];
    /** Flattened list of obstacle placements */
    placements: EntityPlacement[];
}

/**
 * Context provided to pattern generators during placement.
 */
export interface PatternContext {
    riverSystem: RiverSystem;
    placements: EntityPlacement[];
    path: PathPoint[];
    config: BoatPathLayoutConfig;
    range: [number, number];        // index range in path array
    progress: number;               // progress [0-1] along river
    length: number;                 // arc length of the segment
    spatialGrid: SpatialGrid;
    biomeZRange: [number, number];
}

export type PatternConfig = (context: PatternContext) => void;

/**
 * Configuration for a specific, non-procedural placement on a track.
 */
export interface ExplicitPlacementConfig {
    /** Unique name for this placement */
    name: string;
    /** The placement logic to use */
    placement: PlacementConfig;
    /** Progress [0-1] along the biome length */
    at: number;
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
        biomeZRange: [number, number],
        config: BoatPathLayoutConfig
    ): BoatPathLayout {
        const riverSystem = RiverSystem.getInstance();

        // 1. Sample the river
        const path = this.sampleRiver(riverSystem, biomeZRange[1], biomeZRange[0]);
        if (path.length < 2) return { path, placements: [] };

        const totalArcLength = path[path.length - 1].arcLength;

        // 2. Generate each track
        const tracks = this.generateTracks(config, totalArcLength);

        // 3. Generate the boat path (weaving)
        this.generateWeavingPath(path, config, totalArcLength);

        // 4. Determine obstacle placements
        // Initialize spatial grid for collision checking
        const spatialGrid = new SpatialGrid(20);

        const placements = this.resolvePlacements(
            riverSystem,
            path, tracks, config, totalArcLength,
            spatialGrid, biomeZRange);

        return { path, placements };
    }

    private static sampleRiver(
        riverSystem: RiverSystem, zStart: number, zEnd: number
    ): PathPoint[] {
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
        riverSystem: RiverSystem,
        path: PathPoint[],
        tracks: GeneratedTrack[],
        config: BoatPathLayoutConfig,
        totalArcLength: number,
        spatialGrid: SpatialGrid,
        biomeZRange: [number, number]
    ): EntityPlacement[] {
        const placements: EntityPlacement[] = [];

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
                        riverSystem,
                        placements,
                        path,
                        config,
                        range: [sceneIStart, sceneIEnd],
                        progress,
                        length: sceneLenMeters,
                        spatialGrid,
                        biomeZRange
                    };
                    pattern(context);
                }
            }

            // Explicit placements
            for (const ep of track.explicitPlacements) {
                const pathIndex = ep.at * (path.length - 1);

                const context: PatternContext = {
                    riverSystem,
                    placements,
                    path,
                    config,
                    range: [0, path.length],
                    progress: ep.at,
                    length: path[path.length - 1].arcLength,
                    spatialGrid,
                    biomeZRange
                };

                const side = Math.random() < 0.5 ? 'left' : 'right';
                ep.placement(context, pathIndex, side);
            }
        }

        return placements;
    }
}
