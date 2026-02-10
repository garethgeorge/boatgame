import { DecorationPlacement } from "../decorators/DecorationPlacement";
import { WorldParams } from "../decorators/WorldParams";
import { RiverGeometrySample } from "../RiverGeometry";
import { LayoutPlacement } from "./LayoutPlacement";

export type Habitat = 'land' | 'water';

/**
 * Represents a point on the boat path, extending the basic river geometry
 * with a boat-specific X offset for weaving.
 */
export interface PathPoint extends RiverGeometrySample {
    /** Offset from river center along the normal vector (negative is left, positive is right) */
    boatXOffset: number;
}

/**
 * Context passed to generate function to generate the description of
 * an entity that can be placed at a position along the river.
 */
export interface LayoutParams {
    world: WorldParams;
    sample: PathPoint;
    index: number;
    offset: number;
    x: number;
    z: number;
    habitat: Habitat;
    progress: number,
    is_free: (x: number, z: number, r: number) => boolean;
}

/**
 * Interface that receives generated placements. These can include required
 * decoration placements. The id must match a decoration rule. The placements
 * are injected into that rule as seed points.
 */
export interface LayoutPlacements {
    /** Add a layout placement. */
    place(placement: LayoutPlacement): void;

    /** Add a required decoration placement. */
    require(id: string, decoration: DecorationPlacement): void;
}

/**
 * Interface for an object that can fulfill a placement.
 */
export interface LayoutGenerator {
    generate(placements: LayoutPlacements): void;
}

/**
 * A rule is used to produce placements. It defines how to evaluate the space
 * it requires and how to generate the placement once space is reserved.
 */
export type LayoutRule = (ctx: LayoutParams) => LayoutGenerator | null;

