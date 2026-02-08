import { DecorationPlacement } from "./DecorationPlacement";

/**
 * Environmental Context for a rule.
 */
export interface WorldContext {
    pos: { x: number, y: number }; // World X, Z (using y for z in 2D context)
    elevation: number;
    slope: number;
    distanceToRiver: number;
    biomeProgress: number; // 0.0 (Start) to 1.0 (End of river)
    // Helpers to access random values cleanly
    random: () => number;
    gaussian: () => number;
    noise2D: (x: number, y: number) => number;
    sampleMap: (name: string, x?: number, y?: number) => number;
}

/*
 * A rule has a fitness function to evaluate its 'strength' and a function to
 * generate a placement.
 */
export interface DecorationRule {
    // Placement: Returns 0 to 1 (0 = Impossible, 1 = Perfect)
    fitness: (ctx: WorldContext) => number;

    // Attributes: Generates the specific look
    generate: (ctx: WorldContext) => DecorationPlacement;
}
