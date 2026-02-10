import { CoreMath } from "../../core/CoreMath";
import { DecorationPlacement } from "./DecorationPlacement";
import { DecorationRule, DecorationParams } from "./DecorationRule";

export const Signal = {
    constant: (fitness: number) => (ctx: DecorationParams) =>
        fitness,

    // Scaled to [0,1]. Bigger sx, sz values make the noise vary more slowly
    noise2D: (sx: number, sz: number, dx: number = 0, dz: number = 0) => (ctx: DecorationParams) =>
        (ctx.world.noise2D(ctx.x / sx + dx, ctx.z / sz + dz) + 1) / 2.0,

    // Get value from map
    map: (name: string) => (ctx: DecorationParams) =>
        ctx.world.sampleMap(name, ctx.x, ctx.z),

    distanceToRiver: (ctx: DecorationParams) =>
        ctx.distanceToRiver,

    elevation: (ctx: DecorationParams) =>
        ctx.elevation,

    slope: (ctx: DecorationParams) =>
        ctx.slope * 180 / Math.PI,

    inRange: (
        f: (ctx: DecorationParams) => number,
        min: number, max: number = Infinity
    ) => (ctx: DecorationParams) => {
        const v = f(ctx);
        return min <= v && v <= max ? 1 : 0;
    },

    step: (
        f: (ctx: DecorationParams) => number,
        threshold: number
    ) => (ctx: DecorationParams) => {
        const v = f(ctx);
        return v < threshold ? 0.0 : 1.0;
    },

    sin: (freq: number) => (ctx: DecorationParams) =>
        Math.sin(ctx.z * freq),

    max: (a: (ctx: DecorationParams) => number, b: (ctx: DecorationParams) => number) => (ctx: DecorationParams) =>
        Math.max(a(ctx), b(ctx)),

    linearEaseIn: (
        f: (ctx: DecorationParams) => number,
        min0: number, min1: number
    ) => (ctx: DecorationParams) => {
        const v = f(ctx);
        if (v <= min0) return 0;
        if (v >= min1) return 1;
        return CoreMath.linearstep(min0, min1, v);
    },

    linearEaseOut: (
        f: (ctx: DecorationParams) => number,
        max1: number, max0: number
    ) => (ctx: DecorationParams) => {
        const v = f(ctx);
        if (v >= max0) return 0;
        if (v <= max1) return 1;
        return CoreMath.linearstep(max1, max0, v);
    },

    smoothRange: (
        f: (ctx: DecorationParams) => number,
        min0: number, min1: number, max1: number = Infinity, max0: number = Infinity
    ) => (ctx: DecorationParams) => {
        const v = f(ctx);
        if (v <= min0 || v >= max0) return 0;
        if (v >= min1 && v <= max1) return 1;
        if (v < min1) {
            return CoreMath.smoothstep(min0, min1, v);
        }
        if (v > max1) {
            return CoreMath.smoothstep(max1, max0, v);
        }
        return v;
    },
};

export const Combine = {
    // All must be true (Multiplication)
    all: (...fns: Array<(ctx: DecorationParams) => number>) => (ctx: DecorationParams) =>
        fns.reduce((acc, fn) => acc * fn(ctx), 1),

    // Any can be true (Max)
    any: (...fns: Array<(ctx: DecorationParams) => number>) => (ctx: DecorationParams) =>
        Math.max(...fns.map(f => f(ctx))),
};

export type SpeciesGeneratorFn = (ctx: DecorationParams) => DecorationPlacement;

export const Select = {
    choose: (species: SpeciesGeneratorFn[]) => {
        return (ctx: DecorationParams) => {
            return species[Math.floor(Math.random() * species.length)](ctx);
        };
    }
};

export interface Species {
    id?: string;
    // This defines BOTH where it can live and its selection probability
    preference: (ctx: DecorationParams) => number;
    // Return placement manifest for an instance
    params: SpeciesGeneratorFn;
}

// A "Tier" groups similarly sized species
export class TierRule implements DecorationRule {
    public id: string;
    public species: Species[];

    constructor(options: { id?: string, species: Species[] }) {
        this.id = options.id ?? '';
        this.species = options.species;
    }

    // The Tier's fitness is the best-case scenario of its members
    fitness(ctx: DecorationParams): number {
        return Math.max(...this.species.map(s => s.preference(ctx)));
    }

    // Pick the winner based on relative preference or requirement
    generate(ctx: DecorationParams): DecorationPlacement | null {
        const scored = this.species.map(s => ({ s, p: s.preference(ctx) }));
        const winner = scored.reduce((a, b) => a.p > b.p ? a : b).s;
        return winner.params(ctx);
    }
}
