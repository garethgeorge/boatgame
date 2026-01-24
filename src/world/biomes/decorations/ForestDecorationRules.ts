import { MathUtils } from '../../../core/MathUtils';
import { DecorationRule } from '../../decorators/TerrainDecorator';
import { Combine, Signal, TierRule } from '../../decorators/PoissonDecorationRules';

export const FOREST_DECORATION_RULES: DecorationRule[] = [
    new TierRule({
        species: [
            {
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
            },
            {
                id: 'birch_tree',
                preference: Combine.all(
                    Signal.constant(1.0),
                    // Use organic perlin noise clumps instead of sine stripes
                    Signal.step(Signal.noise2D(0.02, 0.02), 0.5),
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
            },
            {
                id: 'oak_tree',
                preference: Combine.all(
                    Signal.constant(0.9), // 0.9 allows Birch (1.0) to win in its clumps, but Oak wins otherwise
                    Signal.inRange(Signal.distanceToRiver, 5, 200)
                ),
                params: (ctx) => {
                    const scale = MathUtils.clamp(0.8, 3.0, 1.0 + ctx.gaussian() * 0.5);
                    return {
                        groundRadius: 1.5 * scale,
                        canopyRadius: 5.0 * scale,
                        options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                    };
                }
            }
        ]
    }),
    new TierRule({
        species: [
            {
                id: 'rock',
                preference: Combine.all(
                    Signal.constant(0.2), // Low probability everywhere
                    // Higher prob near shore?
                    Signal.max(
                        Signal.constant(0.1),
                        Signal.inRange(Signal.distanceToRiver, 2, 10) // Shore rocks
                    )
                ),
                params: (ctx) => {
                    const scale = 0.7 + ctx.random() * 0.8;
                    return {
                        groundRadius: 2.5 * scale,
                        spacing: 5.0 * scale,
                        options: { kind: 'rock', rotation: ctx.random() * Math.PI * 2, scale }
                    };
                }
            }
        ]
    })
];
