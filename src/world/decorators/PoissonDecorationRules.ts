import { DecorationRule, PlacementManifest, WorldContext } from "./PoissonDecorationStrategy";


export const Signal = {
    constant: (fitness: number) => (ctx: WorldContext) =>
        fitness,

    // Steepness: 1 at flat, 0 at cliff
    flatness: (threshold = 0.5) => (ctx: WorldContext) =>
        Math.max(0, 1 - (ctx.slope / threshold)),

    // Distance: from river 0 or 1
    riverRange: (minDist: number, maxDist: number = Infinity) => (ctx: WorldContext) =>
        minDist <= ctx.distanceToRiver && ctx.distanceToRiver <= maxDist ? 1 : 0,

    // Height: 0 or 1
    heightRange: (minHeight: number, maxHeight: number = Infinity) => (ctx: WorldContext) =>
        minHeight <= ctx.elevation && ctx.elevation <= maxHeight ? 1 : 0,

    // Noise: 0 to 1 organic clumps
    clumps: (scale: number, seed: number) => (ctx: WorldContext) =>
        (ctx.noise2D(ctx.pos.x * scale, ctx.pos.y * scale) + 1) / 2
};

export const Combine = {
    // All must be true (Multiplication)
    all: (...fns: Array<(ctx: WorldContext) => number>) => (ctx: WorldContext) =>
        fns.reduce((acc, fn) => acc * fn(ctx), 1),

    // Any can be true (Max)
    any: (...fns: Array<(ctx: WorldContext) => number>) => (ctx: WorldContext) =>
        Math.max(...fns.map(f => f(ctx))),

    // Linear interpolation between two values (for transitions)
    lerp: (a: number, b: number, t: number) => a + (b - a) * t
};

export interface Species {
    id: string;
    radius: number;
    // This defines BOTH where it can live and its selection probability
    preference: (ctx: WorldContext) => number;
    // Return placement manifest for an instance
    params: (ctx: WorldContext) => { scale: number, options: any };
}

// A "Tier" groups similarly sized species
export class TierRule implements DecorationRule {
    public baseRadius: number;
    public species: Species[];

    constructor(options: { baseRadius: number, species: Species[] }) {
        this.baseRadius = options.baseRadius;
        this.species = options.species;
    }

    // The Tier's fitness is the best-case scenario of its members
    fitness(ctx: WorldContext): number {
        return Math.max(...this.species.map(s => s.preference(ctx)));
    }

    // Pick the winner based on relative preference
    generate(ctx: WorldContext): { scale: number, options: any } {
        const scored = this.species.map(s => ({ s, p: s.preference(ctx) }));
        const winner = scored.reduce((a, b) => a.p > b.p ? a : b).s;
        return winner.params(ctx);
    }
}
