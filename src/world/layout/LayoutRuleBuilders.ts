import * as THREE from 'three';
import { LayoutParams, LayoutPlacements, LayoutRule, LayoutGenerator } from './LayoutRule';
import { DecorationParams, DecorationGenerator } from '../decorators/DecorationRule';

export type PlacementPredicate = (ctx: LayoutParams, groundRadius: number) => boolean;

export class LayoutRules {

    /**
     * Creates a layout rule for an entity and an associated decoration.
     * The entity is placed and a requirement is made for the decoration
     * to be placed. Both will end up in the same position. It is assumed
     * the entity will attach to the decoration (e.g. a bird on a perch).
     * 
     * The id must identify a decoration rule. The decoration requirements
     * are injected into that rule.
     * 
     * The radius value is used to ensure there is space free.
     */
    public static attachment(
        layout: LayoutRule,
        scenery: DecorationGenerator,
        id: string,
        radius: number,
    ): LayoutRule {
        return (ctx: LayoutParams) => {
            if (!ctx.is_free(ctx.x, ctx.z, radius)) return null;

            // get the entity generator
            const entity = layout(ctx);
            if (!entity)
                return null;

            // get the decoration to require
            const { height, slope, distToRiver } = ctx.world.terrainProvider(ctx.x, ctx.z);
            const sceneryCtx: DecorationParams = {
                world: ctx.world,
                x: ctx.x, z: ctx.z,
                elevation: height,
                slope: slope,
                distanceToRiver: distToRiver
            };
            const decoration = scenery(sceneryCtx);
            if (!decoration)
                return null;

            return {
                generate: (placements: LayoutPlacements) => {
                    entity.generate(placements);
                    placements.require(id, decoration);
                }
            }
        }
    }

    public static choose(rules: LayoutRule[]): LayoutRule {
        return (ctx: LayoutParams) => {
            if (rules.length === 0) return null;
            const index = Math.floor(Math.random() * rules.length);
            return rules[index](ctx);
        };
    }

    public static all(predicates: PlacementPredicate[]): PlacementPredicate {
        return (ctx: LayoutParams, groundRadius: number) => {
            for (const p of predicates) {
                if (!p(ctx, groundRadius)) return false;
            }
            return true;
        };
    }

    public static select(choice: { water?: PlacementPredicate, land?: PlacementPredicate }): PlacementPredicate {
        return (ctx: LayoutParams, groundRadius: number) => {
            if (ctx.habitat === 'water' && choice.water !== undefined) {
                return choice.water(ctx, groundRadius);
            } else if (ctx.habitat === 'land' && choice.land !== undefined) {
                return choice.land(ctx, groundRadius);
            }
            return false;
        }
    }

    public static true(): PlacementPredicate {
        return (ctx: LayoutParams, groundRadius: number) => true;
    }

    public static is_free(): PlacementPredicate {
        return (ctx: LayoutParams, r: number) => {
            return ctx.is_free(ctx.x, ctx.z, r);
        }
    }

    public static slope_in_range(min: number, max: number): PlacementPredicate {
        return (ctx: LayoutParams, groundRadius: number) => {
            const normal = ctx.world.riverSystem.terrainGeometry.calculateNormal(ctx.x, ctx.z);
            const up = new THREE.Vector3(0, 1, 0);
            const angleRad = normal.angleTo(up);
            const angleDeg = angleRad * 180 / Math.PI;
            return (min <= angleDeg && angleDeg <= max);
        };
    }

    public static min_bank_distance(min: number): PlacementPredicate {
        return (ctx: LayoutParams, groundRadius: number) => {
            return Math.abs(Math.abs(ctx.offset) - ctx.sample.bankDist) > groundRadius + min;
        }
    }
}
