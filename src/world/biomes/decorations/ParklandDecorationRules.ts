import { MathUtils } from '../../../core/MathUtils';
import { DecorationRule } from '../../decorators/TerrainDecorator';
import { Combine, Signal, TierRule } from '../../decorators/PoissonDecorationRules';

export const PARKLAND_DECORATION_RULES: DecorationRule[] = [
    new TierRule({
        species: [
            {
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
            },
            {
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
            },
            {
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
            }
        ]
    }),
    new TierRule({
        species: [
            {
                id: 'flower',
                preference: Combine.all(
                    Signal.constant(0.5),
                    Signal.inRange(Signal.distanceToRiver, 2, 30),
                    Signal.inRange(Signal.slope, 0, 15)
                ),
                params: (ctx) => {
                    const scale = 0.7 + ctx.random() * 0.5;
                    return {
                        groundRadius: 0.8 * scale,
                        options: { kind: 'flower', rotation: ctx.random() * Math.PI * 2, scale }
                    };
                }
            }
        ]
    })
];
