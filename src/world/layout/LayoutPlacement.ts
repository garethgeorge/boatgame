import { EntityIds } from "../../entities/EntityIds";
import { PopulationContext } from "../biomes/PopulationContext";
import { RiverGeometrySample } from "../RiverGeometry";

/**
 * Placement describes how to place an instance.
 * index is the fractional index of the river position.
 */
export interface LayoutPlacement {
    readonly index: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly radius: number;

    /** The entity ID for telemetry and identity. */
    get id(): EntityIds;

    /** Spawns the entity into the world. */
    spawn(context: PopulationContext, sample: RiverGeometrySample): void;

    /** 
     * Generator that yields promises for assets that must be loaded 
     * before this entity can be spawned.
     */
    ensureLoaded(): Generator<void | Promise<void>, void, unknown>;
}
