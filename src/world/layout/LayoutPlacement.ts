import { EntityIds } from "../../entities/EntityIds";
import { PopulationContext } from "../biomes/PopulationContext";
import { DecorationId } from "../decorations/Decorations";
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

    /** Spawns the entity into the world. */
    spawn(context: PopulationContext, sample: RiverGeometrySample): void;

    /** 
     * Generator that yields promises for assets that must be loaded 
     * before this entity can be spawned.
     * @param loaded Set of decoration IDs already being loaded/loaded.
     */
    ensureLoaded(loaded: Set<DecorationId>): Generator<void | Promise<void>, void, unknown>;
}
