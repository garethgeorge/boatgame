import { MathUtils } from "../../../core/MathUtils";
import { Combine, Signal } from "../../decorators/PoissonDecorationRules";
import { WorldContext } from "../../decorators/PoissonDecorationStrategy";
import { FlowerPalettes } from "../../decorators/FlowerPalettes";

export interface FitnessParams {
    // overall fitness multiplier
    fitness?: number,
    // min fitness value regardless of other factors
    minFitness?: number,

    // River distance parameters
    // 0 up to first value, reaches 1 at second
    linearDistance?: [number, number],
    // 0 outside the range, 1 inside
    stepDistance?: [number, number],

    // Elevation must be between these values
    elevation?: [number, number],

    // Slope must be between these values
    slope?: [number, number]
}

export class SpeciesRules {

    private static buildFitness(params: FitnessParams) {

        let fitnessFuncs: ((ctx: WorldContext) => number)[] = [];

        fitnessFuncs.push(Signal.constant(params.fitness ?? 1.0));

        if (params.stepDistance !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.distanceToRiver,
                params.stepDistance[0], params.stepDistance[1]
            ));
        }
        if (params.linearDistance !== undefined) {
            fitnessFuncs.push(Signal.linearRange(Signal.distanceToRiver,
                params.linearDistance[0], params.linearDistance[1]
            ))
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

    public static rock(params: FitnessParams) {
        return {
            id: 'rock',
            preference: SpeciesRules.buildFitness(params),
            params: (ctx) => {
                const scale = 0.8 + ctx.random() * 0.8;
                return {
                    groundRadius: 5 * scale,
                    spacing: 10.0 * scale,
                    options: { kind: 'rock', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        };
    }

    public static elder_tree() {
        return {
            id: 'elder_tree',
            preference: Combine.all(
                Signal.constant(1.0),
                // Only spawn far from river
                Signal.stepLinear(Signal.distanceToRiver, 60, 70),
                // Rare spawn chance (5%) implemented via noise gating
                Signal.step(Signal.noise2D(123.4, 123.4), 0.95)
            ),
            params: (ctx) => {
                const scale = 2.0 + ctx.random() * 0.5; // Large scale
                return {
                    groundRadius: 1.0 * scale,
                    canopyRadius: 5.0 * scale,
                    spacing: 25.0 * scale,
                    options: { kind: 'elder', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        }
    }

    public static birch_tree() {
        return {
            id: 'birch_tree',
            preference: Combine.all(
                Signal.constant(1.0),
                // Use organic perlin noise clumps instead of sine stripes
                Signal.step(Signal.noise2D(50, 50), 0.5),
                // Avoid river
                Signal.inRange(Signal.distanceToRiver, 5, 200)
            ),
            params: (ctx) => {
                const scale = MathUtils.clamp(0.6, 1.8, 0.9 + ctx.gaussian() * 0.3);
                return {
                    groundRadius: 1.2 * scale,
                    canopyRadius: 4.0 * scale,
                    options: { kind: 'birch', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        };
    }

    public static oak_tree(params: FitnessParams) {
        return {
            id: 'oak_tree',
            preference: SpeciesRules.buildFitness(params),
            params: (ctx) => {
                const scale = MathUtils.clamp(0.8, 3.0, 1.0 + ctx.gaussian() * 0.5);
                return {
                    groundRadius: 1.5 * scale,
                    canopyRadius: 5.0 * scale,
                    options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        };
    }

    public static elm_tree() {
        return {
            id: 'elm_tree',
            preference: Combine.all(
                Signal.constant(1.0),
                Signal.step(Signal.noise2D(400.0, 400.0, 0.3, 0.4), 0.5),
                Signal.inRange(Signal.distanceToRiver, 10, 60),
                Signal.inRange(Signal.slope, 0, 25)
            ),
            params: (ctx) => {
                const scale = 1.0 + ctx.random() * 0.5;
                return {
                    groundRadius: 2.0 * scale,
                    canopyRadius: 6.0 * scale,
                    spacing: 15.0 * scale,
                    options: { kind: 'elm', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        };
    }

    public static box_elder() {
        return {
            id: 'vase_tree',
            preference: Combine.all(
                Signal.constant(0.8),
                Signal.inRange(Signal.distanceToRiver, 15, 50),
                Signal.inRange(Signal.slope, 0, 20)
            ),
            params: (ctx) => {
                const scale = 0.9 + ctx.random() * 0.4;
                return {
                    groundRadius: 1.5 * scale,
                    canopyRadius: 4.5 * scale,
                    options: { kind: 'vase', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        };
    }

    public static willow_tree() {
        return {
            id: 'willow_tree',
            preference: Combine.all(
                Signal.constant(1.0),
                Signal.step(Signal.noise2D(500.0, 250.0, 0.2, 0.3), 0.6),
                Signal.inRange(Signal.distanceToRiver, 5, 25),
                Signal.inRange(Signal.elevation, 1.0, 5.0),
                Signal.inRange(Signal.slope, 0, 15)
            ),
            params: (ctx) => {
                const scale = 0.8 + ctx.random() * 0.4;
                return {
                    groundRadius: 2 * scale,
                    canopyRadius: 5 * scale,
                    options: { kind: 'willow', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        };
    }

    public static poplar_tree() {
        return {
            id: 'poplar',
            preference: Combine.all(
                Signal.step(Signal.noise2D(500.0, 250.0, 0.5, 0.1), 0.7),
                Signal.inRange(Signal.distanceToRiver, 20, 40),
                Signal.inRange(Signal.slope, 0, 15)
            ),
            params: (ctx) => {
                const scale = 0.7 + ctx.random() * 0.6;
                return {
                    groundRadius: 0.5 * scale,
                    canopyRadius: 1.5 * scale,
                    spacing: 2 * scale,
                    options: { kind: 'poplar', rotation: ctx.random() * Math.PI * 2, scale }
                }
            }
        };
    }

    public static japanese_maple() {
        return {
            id: 'open_tree',
            preference: Combine.all(
                Signal.constant(0.7),
                Signal.inRange(Signal.distanceToRiver, 5, 40),
                Signal.inRange(Signal.slope, 0, 30)
            ),
            params: (ctx) => {
                const scale = 0.8 + ctx.random() * 0.6;
                return {
                    groundRadius: 1.2 * scale,
                    canopyRadius: 4.0 * scale,
                    options: { kind: 'open', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        };
    }

    public static daisy(paletteName: string = 'daisy') {
        return {
            id: 'daisy',
            preference: Combine.all(
                Signal.constant(1),
                Signal.inRange(Signal.distanceToRiver, 2, 30),
                Signal.inRange(Signal.slope, 0, 15),
                Signal.step(Signal.noise2D(100.0, 100.0, Math.random(), Math.random()), 0.7),
            ),
            params: (ctx: WorldContext) => {
                const scale = 0.7 + ctx.random() * 0.5;
                const palette = FlowerPalettes.getPalette(paletteName);
                const petalColor = FlowerPalettes.getInterpolatedColor(palette, ctx.random());
                return {
                    groundRadius: 0.8 * scale,
                    spacing: 2 * scale,
                    options: { kind: 'daisy', rotation: ctx.random() * Math.PI * 2, scale, petalColor }
                };
            }
        };
    }

    public static lily(paletteName: string = 'lily') {
        return {
            id: 'lily',
            preference: Combine.all(
                Signal.constant(1),
                Signal.inRange(Signal.distanceToRiver, 2, 30),
                Signal.inRange(Signal.slope, 0, 15),
                Signal.step(Signal.noise2D(100.0, 100.0, Math.random(), Math.random()), 0.7),
            ),
            params: (ctx: WorldContext) => {
                const scale = 0.7 + ctx.random() * 0.5;
                const palette = FlowerPalettes.getPalette(paletteName);
                const petalColor = FlowerPalettes.getInterpolatedColor(palette, ctx.random());
                return {
                    groundRadius: 1 * scale,
                    spacing: 2 * scale,
                    options: { kind: 'lily', rotation: ctx.random() * Math.PI * 2, scale, petalColor }
                };
            }
        };
    }
}
