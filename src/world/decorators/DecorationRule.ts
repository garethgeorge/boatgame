import { DecorationPlacement } from "./DecorationPlacement";
import { WorldParams } from "./WorldParams";

/**
 * Environmental Context for a rule. When generating required decorations
 * a requirement is passed in the world context.
 */
export interface DecorationParams {
    x: number,
    z: number,
    elevation: number;
    slope: number;
    distanceToRiver: number;
    world: WorldParams;
}

export type DecorationGenerator =
    (ctx: DecorationParams) => DecorationPlacement | null;

/*
 * A rule has a fitness function to evaluate its 'strength' and a function to
 * generate a placement.
 */
export interface DecorationRule {
    id: string,

    // Placement: Returns 0 to 1 (0 = Impossible, 1 = Perfect)
    fitness: (ctx: DecorationParams) => number;

    // Attributes: Generates the specific look
    generate: DecorationGenerator;
}
