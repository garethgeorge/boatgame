import { MathUtils } from '../../../core/MathUtils';
import { DecorationRule } from '../../decorators/TerrainDecorator';
import { Combine, Signal, TierRule } from '../../decorators/PoissonDecorationRules';

export const RIVERLAND_DECORATION_RULES: DecorationRule[] = [
    new TierRule({
        species: [
            {
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
            },
            {
                id: 'oak_tree',
                preference: Combine.all(
                    Signal.constant(1.0),
                    Signal.linearRange(Signal.distanceToRiver, 20, 50),
                    Signal.inRange(Signal.elevation, 3.0, 20.0),
                    Signal.inRange(Signal.slope, 0, 50)
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
            },
        ]
    }),
    new TierRule({
        species: [
            {
                id: 'rock',
                preference: Combine.all(
                    Signal.constant(1.0),
                    Signal.inRange(Signal.distanceToRiver, 3, 20),
                    Signal.inRange(Signal.elevation, 6.0),
                    Signal.inRange(Signal.slope, 50)
                ),
                params: (ctx) => {
                    const scale = 0.8 + ctx.random() * 0.8;
                    return {
                        groundRadius: 5.0 * scale,
                        spacing: 10.0 * scale,
                        options: { kind: 'rock', rotation: ctx.random() * Math.PI * 2, scale }
                    };
                }
            },
        ]
    }),
    new TierRule({
        species: [
            {
                id: 'flower',
                preference: Combine.all(
                    Signal.constant(1.0),
                    Signal.inRange(Signal.distanceToRiver, 5, 25),
                    Signal.inRange(Signal.elevation, 1.0, 5.0),
                    Signal.inRange(Signal.slope, 0, 15)
                ),
                params: (ctx) => {
                    const scale = 0.8 + ctx.random() * 0.4;
                    return {
                        groundRadius: 1.0 * scale,
                        options: { kind: 'flower', rotation: ctx.random() * Math.PI * 2, scale }
                    };
                }
            },
        ]
    })
];
