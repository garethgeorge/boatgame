import { PlacementManifest } from "../../core/SpatialGrid";
import { EntityIds } from "../../entities/EntityIds";
import { PopulationContext } from "../biomes/PopulationContext";
import { RiverGeometrySample } from "../RiverGeometry";

/**
 * Placement describes how to place an instance.
 * index is the fractional index of the river position.
 */
export abstract class LayoutPlacement implements PlacementManifest {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly groundRadius: number,
        public readonly canopyRadius: number = 0
    ) { }

    /** The entity ID for telemetry and identity. */
    public abstract get id(): EntityIds;

    /** Spawns the entity into the world. */
    public abstract spawn(context: PopulationContext, sample: RiverGeometrySample): void;

    /** 
     * Generator that yields promises for assets that must be loaded 
     * before this entity can be spawned.
     */
    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        // Default: nothing to load
    }
}
