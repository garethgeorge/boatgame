import { CoreMath } from "../../core/CoreMath";
import { DecorationRule, WorldContext } from "./PoissonDecorationStrategy";

export const Signal = {
    constant: (fitness: number) => (ctx: WorldContext) =>
        fitness,

    // Scaled to [0,1]. Bigger sx, sy values make the noise vary more slowly
    noise2D: (sx: number, sy: number, dx: number = 0, dy: number = 0) => (ctx: WorldContext) =>
        (ctx.noise2D(ctx.pos.x / sx + dx, ctx.pos.y / sy + dy) + 1) / 2.0,

    // Get value from map
    map: (name: string) => (ctx: WorldContext) =>
        ctx.sampleMap(name, ctx.pos.x, ctx.pos.y),

    distanceToRiver: (ctx: WorldContext) =>
        ctx.distanceToRiver,

    elevation: (ctx: WorldContext) =>
        ctx.elevation,

    slope: (ctx: WorldContext) =>
        ctx.slope * 180 / Math.PI,

    inRange: (
        f: (ctx: WorldContext) => number,
        min: number, max: number = Infinity
    ) => (ctx: WorldContext) => {
        const v = f(ctx);
        return min <= v && v <= max ? 1 : 0;
    },

    step: (
        f: (ctx: WorldContext) => number,
        threshold: number
    ) => (ctx: WorldContext) => {
        const v = f(ctx);
        return v < threshold ? 0.0 : 1.0;
    },

    sin: (freq: number) => (ctx: WorldContext) =>
        Math.sin(ctx.pos.y * freq),

    max: (a: (ctx: WorldContext) => number, b: (ctx: WorldContext) => number) => (ctx: WorldContext) =>
        Math.max(a(ctx), b(ctx)),

    linearEaseIn: (
        f: (ctx: WorldContext) => number,
        min0: number, min1: number
    ) => (ctx: WorldContext) => {
        const v = f(ctx);
        if (v <= min0) return 0;
        if (v >= min1) return 1;
        return CoreMath.linearstep(min0, min1, v);
    },

    linearEaseOut: (
        f: (ctx: WorldContext) => number,
        max1: number, max0: number
    ) => (ctx: WorldContext) => {
        const v = f(ctx);
        if (v >= max0) return 0;
        if (v <= max1) return 1;
        return CoreMath.linearstep(max1, max0, v);
    },

    smoothRange: (
        f: (ctx: WorldContext) => number,
        min0: number, min1: number, max1: number = Infinity, max0: number = Infinity
    ) => (ctx: WorldContext) => {
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
    all: (...fns: Array<(ctx: WorldContext) => number>) => (ctx: WorldContext) =>
        fns.reduce((acc, fn) => acc * fn(ctx), 1),

    // Any can be true (Max)
    any: (...fns: Array<(ctx: WorldContext) => number>) => (ctx: WorldContext) =>
        Math.max(...fns.map(f => f(ctx))),
};

export type SpeciesGeneratorFn = (ctx: WorldContext) => {
    groundRadius: number,
    canopyRadius?: number,
    spacing?: number,
    options: any
};

export const Select = {
    choose: (species: SpeciesGeneratorFn[]) => {
        return (ctx: WorldContext) => {
            return species[Math.floor(Math.random() * species.length)](ctx);
        };
    }
};

export interface Species {
    id: string;
    // This defines BOTH where it can live and its selection probability
    preference: (ctx: WorldContext) => number;
    // Return placement manifest for an instance
    params: SpeciesGeneratorFn;
}

// A "Tier" groups similarly sized species
export class TierRule implements DecorationRule {
    public species: Species[];

    constructor(options: { species: Species[] }) {
        this.species = options.species;
    }

    // The Tier's fitness is the best-case scenario of its members
    fitness(ctx: WorldContext): number {
        return Math.max(...this.species.map(s => s.preference(ctx)));
    }

    // Pick the winner based on relative preference
    generate(ctx: WorldContext): {
        groundRadius: number,
        canopyRadius?: number,
        spacing?: number,
        options: any
    } {
        const scored = this.species.map(s => ({ s, p: s.preference(ctx) }));
        const winner = scored.reduce((a, b) => a.p > b.p ? a : b).s;
        let params = winner.params(ctx);
        return {
            ...params
        };
    }
}
