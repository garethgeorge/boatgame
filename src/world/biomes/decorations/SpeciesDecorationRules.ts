import { MathUtils } from "../../../core/MathUtils";
import { Combine, Signal } from "../../decorators/PoissonDecorationRules";
import { WorldContext } from "../../decorators/PoissonDecorationStrategy";
import { ColorPalettes } from "../../decorators/ColorPalettes";
import { DecorationMetadata } from "../../DecorationMetadata";

/** 
 * Parameters for building a fitness function that is the product
 * of the parameters.
 */
export interface FitnessParams {
    // overall fitness multiplier
    fitness?: number,
    // min fitness value regardless of other factors
    minFitness?: number,

    // River distance parameters
    // 0 up to first value, reaches 1 at second
    linearEaseIn?: [number, number],
    // 1 up to first value, reaches 0 at second
    linearEaseOut?: [number, number],
    // 0 outside the range, 1 inside
    stepDistance?: [number, number],

    // Samples 2D noise and returns 1 if value exceeds threshold
    stepNoise?: {
        scale: number | [number, number],
        threshold: number
    },

    // 1 if the named map value is in range
    map?: { name: string, range: [number, number] },

    // Elevation must be between these values
    elevation?: [number, number],

    // Slope must be between these values
    slope?: [number, number]
}

export class SpeciesRules {

    public static fitness(params: FitnessParams) {

        let fitnessFuncs: ((ctx: WorldContext) => number)[] = [];

        fitnessFuncs.push(Signal.constant(params.fitness ?? 1.0));

        if (params.stepDistance !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.distanceToRiver,
                params.stepDistance[0], params.stepDistance[1]
            ));
        }
        if (params.linearEaseIn !== undefined) {
            fitnessFuncs.push(Signal.linearEaseIn(Signal.distanceToRiver,
                params.linearEaseIn[0], params.linearEaseIn[1]
            ))
        }
        if (params.linearEaseOut !== undefined) {
            fitnessFuncs.push(Signal.linearEaseOut(Signal.distanceToRiver,
                params.linearEaseOut[0], params.linearEaseOut[1]
            ))
        }
        if (params.stepNoise !== undefined) {
            const scale = params.stepNoise.scale;
            const sx = Array.isArray(scale) ? scale[0] : scale;
            const sy = Array.isArray(scale) ? scale[1] : scale;
            const dx = Math.random();
            const dy = Math.random();
            const threshold = params.stepNoise.threshold;
            fitnessFuncs.push(Signal.step(
                Signal.noise2D(sx, sy, dx, dy),
                threshold));
        }
        if (params.map !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.map(params.map.name),
                params.map.range[0], params.map.range[1]));
        }
        if (params.elevation !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.elevation,
                params.elevation[0], params.elevation[1]));
        }
        if (params.slope !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.slope,
                params.slope[0], params.slope[1]));
        }

        if (params.minFitness !== undefined) {
            fitnessFuncs = [
                Signal.max(
                    Signal.constant(params.minFitness),
                    Combine.all(...fitnessFuncs))
            ];
        }

        return fitnessFuncs.length === 1 ?
            fitnessFuncs[0] : Combine.all(...fitnessFuncs);
    }

    public static rock(options: { rockBiome?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.8;
            return {
                groundRadius: DecorationMetadata.rock.groundRadius * scale,
                spacing: 10.0,
                options: {
                    kind: 'rock',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    rockBiome: options.rockBiome
                }
            };
        };
    }

    public static elder_tree(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 2.0 + ctx.random() * 0.5; // Large scale
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.elder;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 25.0,
                options: { kind: 'elder', rotation: ctx.random() * Math.PI * 2, scale, color }
            };
        }
    }

    public static birch_tree(options: {
        spacing?: number,
        paletteName?: string
    } = {}) {
        const {
            spacing = undefined,
            paletteName = undefined
        } = options;
        return (ctx: WorldContext) => {
            const scale = MathUtils.clamp(0.6, 1.8, 0.9 + ctx.gaussian() * 0.3);
            const color = paletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) :
                undefined;
            const meta = DecorationMetadata.birch;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: spacing,
                options: { kind: 'birch', rotation: ctx.random() * Math.PI * 2, scale, color }
            };
        };
    }

    public static oak_tree(options: { paletteName?: string, snow?: boolean, leaves?: number } = {}) {
        const {
            paletteName = undefined,
            snow = false,
            leaves = 1
        } = options;
        return (ctx: WorldContext) => {
            const scale = MathUtils.clamp(0.8, 3.0, 1.0 + ctx.gaussian() * 0.5);
            const color = paletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) :
                undefined;
            const meta = DecorationMetadata.oak;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: {
                    kind: 'oak',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    color,
                    isSnowy: snow,
                    isLeafLess: ctx.random() > leaves
                }
            };
        };
    }

    public static elm_tree(options: {
        size?: number,
        spacing?: number,
        paletteName?: string,
        woodPaletteName?: string,
        snow?: boolean,
        leaves?: number
    } = {}) {
        const {
            size = 1,
            spacing = 15,
            paletteName = undefined,
            woodPaletteName = undefined,
            snow = false,
            leaves = 1
        } = options;
        return (ctx: WorldContext) => {
            const scale = size * (1.0 + ctx.random() * 0.5);
            const color = paletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) :
                undefined;
            const woodColor = woodPaletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(woodPaletteName), ctx.random()) :
                undefined;
            const meta = DecorationMetadata.elm;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: spacing,
                options: {
                    kind: 'elm',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    color,
                    woodColor,
                    isSnowy: snow,
                    isLeafLess: ctx.random() > leaves
                }
            };
        };
    }

    public static box_elder(options: {
        size?: number,
        paletteName?: string
    } = {}) {
        const {
            size = 1,
            paletteName = undefined
        } = options;
        return (ctx: WorldContext) => {
            const scale = size * 0.9 + ctx.random() * 0.4;
            const color = paletteName !== undefined ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.vase;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: { kind: 'vase', rotation: ctx.random() * Math.PI * 2, scale, color }
            };
        };
    }

    public static willow_tree(options: {
        spacing?: number,
        paletteName?: string,
        woodPaletteName?: string
    } = {}) {
        const {
            spacing = 0,
            paletteName = undefined,
            woodPaletteName = undefined
        } = options;
        return (ctx: WorldContext) => {
            const scale = 2.0 + ctx.random() * 1.0;
            const color = paletteName !== undefined ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) : undefined;
            const woodColor = woodPaletteName !== undefined ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(woodPaletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.willow;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: spacing,
                options: { kind: 'willow', rotation: ctx.random() * Math.PI * 2, scale, color, woodColor }
            };
        };
    }

    public static poplar_tree(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.6;
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.poplar;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 2,
                options: { kind: 'poplar', rotation: ctx.random() * Math.PI * 2, scale, color }
            }
        };
    }

    public static japanese_maple(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.6;
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.open;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: { kind: 'open', rotation: ctx.random() * Math.PI * 2, scale, color }
            };
        };
    }

    public static daisy(options: {
        pack?: number,
        spacing?: number,
        paletteName?: string
    } = {}) {
        const {
            pack = 1,
            spacing = 2,
            paletteName = 'daisy'
        } = options;
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.5;
            const palette = ColorPalettes.getPalette(paletteName);
            const color = ColorPalettes.getInterpolatedColor(palette, ctx.random());
            const meta = DecorationMetadata.daisy;
            return {
                groundRadius: meta.groundRadius * scale * pack,
                spacing: spacing,
                options: { kind: 'daisy', rotation: ctx.random() * Math.PI * 2, scale, color }
            };
        };
    }

    public static lily(options: {
        pack?: number,
        spacing?: number,
        paletteName?: string
    } = {}) {
        const {
            pack = 1,
            spacing = 2,
            paletteName = 'lily'
        } = options;
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.5;
            const palette = ColorPalettes.getPalette(paletteName);
            const color = ColorPalettes.getInterpolatedColor(palette, ctx.random());
            const meta = DecorationMetadata.lily;
            return {
                groundRadius: meta.groundRadius * scale * pack,
                spacing: spacing,
                options: { kind: 'lily', rotation: ctx.random() * Math.PI * 2, scale, color }
            };
        };
    }

    public static cactus() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.cactus;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 1,
                options: { kind: 'cactus', rotation: ctx.random() * Math.PI * 2, scale }
            };
        };
    }

    public static cycad() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.cycad;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 1,
                options: { kind: 'cycad', rotation: ctx.random() * Math.PI * 2, scale }
            };
        };
    }

    public static tree_fern() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.treeFern;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 1,
                options: { kind: 'treeFern', rotation: ctx.random() * Math.PI * 2, scale }
            };
        };
    }

    public static mangrove() {
        return (ctx: WorldContext) => {
            const scale = 1.5 + ctx.random() * 0.5;
            const meta = DecorationMetadata.mangrove;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: { kind: 'mangrove', rotation: ctx.random() * Math.PI * 2, scale }
            };
        }
    }

    public static palm_tree() {
        return (ctx: WorldContext) => {
            const scale = 1.5 + ctx.random() * 1.0;
            const meta = DecorationMetadata.palm;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: { kind: 'palm', rotation: ctx.random() * Math.PI * 2, scale }
            };
        };
    }
}
