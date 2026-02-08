import { RiverGeometrySample } from "../RiverGeometry";
import { RiverSystem } from "../RiverSystem";
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
 * EntityGeneratorFn is called with context to generate the description of
 * an entity that can be placed at a position along the river.
 */
export interface LayoutContext {
    riverSystem: RiverSystem;
    sample: PathPoint;
    index: number;
    offset: number;
    x: number;
    z: number;
    habitat: Habitat;
    progress: number,
    biomeZRange: [number, number]
};

export type LayoutRule = (ctx: LayoutContext) =>
    LayoutPlacement | null;
