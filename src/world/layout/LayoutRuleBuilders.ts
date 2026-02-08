import * as THREE from 'three';
import { LayoutContext, LayoutRule } from './LayoutRule';

export type PlacementPredicate = (ctx: LayoutContext, groundRadius: number) => boolean;

export class LayoutRules {
    public static choose(types: LayoutRule[]) {
        return (ctx: LayoutContext) => {
            const type = types[Math.floor(Math.random() * types.length)];
            return type(ctx);
        }
    }

    public static all(predicates: PlacementPredicate[]): PlacementPredicate {
        return (ctx: LayoutContext, groundRadius: number) => {
            for (const p of predicates) {
                if (!p(ctx, groundRadius)) return false;
            }
            return true;
        };
    }

    public static select(choice: { water?: PlacementPredicate, land?: PlacementPredicate }): PlacementPredicate {
        return (ctx: LayoutContext, groundRadius: number) => {
            if (ctx.habitat === 'water' && choice.water !== undefined) {
                return choice.water(ctx, groundRadius);
            } else if (ctx.habitat === 'land' && choice.land !== undefined) {
                return choice.land(ctx, groundRadius);
            }
            return false;
        }
    }

    public static true(): PlacementPredicate {
        return (ctx: LayoutContext, groundRadius: number) => true;
    }

    public static slope_in_range(min: number, max: number): PlacementPredicate {
        return (ctx: LayoutContext, groundRadius: number) => {
            const normal = ctx.riverSystem.terrainGeometry.calculateNormal(ctx.x, ctx.z);
            const up = new THREE.Vector3(0, 1, 0);
            const angleRad = normal.angleTo(up);
            const angleDeg = angleRad * 180 / Math.PI;
            return (min <= angleDeg && angleDeg <= max);
        };
    }

    public static min_bank_distance(min: number): PlacementPredicate {
        return (ctx: LayoutContext, groundRadius: number) => {
            return Math.abs(Math.abs(ctx.offset) - ctx.sample.bankDist) > groundRadius + min;
        }
    }
}
