import * as THREE from 'three';
import { EntityIds } from "../../../entities/EntityIds";
import { RiverGeometrySample } from "../../RiverGeometry";
import { PopulationContext } from "../../biomes/PopulationContext";
import { DecorationId } from '../../Decorations';
import { RiverSystem } from "../../RiverSystem";

export type Habitat = 'land' | 'water';

/**
 * Represents a point on the boat path, extending the basic river geometry
 * with a boat-specific X offset for weaving.
 */
export interface PathPoint extends RiverGeometrySample {
    /** Offset from river center along the normal vector (negative is left, positive is right) */
    boatXOffset: number;
}

/**
 * EntityGeneratorFn is called with context to generate the description of
 * an entity that can be placed at a position along the river.
 */
export interface EntityGeneratorContext {
    riverSystem: RiverSystem;
    sample: PathPoint;
    index: number;
    offset: number;
    x: number;
    z: number;
    habitat: Habitat;
    progress: number,
    biomeZRange: [number, number]
};

export type EntityGeneratorFn = (ctx: EntityGeneratorContext) =>
    EntityPlacement | null;


/**
 * The entity description includes a spawn config used to preload and spawn
 * the entity.
 */
export class EntitySpawnConfig {
    public id: EntityIds;
    public decorationIds: DecorationId[] = [];

    public spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    }
};

/**
 * The entity placement is minimally comprised of the x,y position of the
 * entity center, its radius and spawn config. Note that the center need
 * not be the same as the offset position passed since objets such as piers
 * or buoys may extend from the offset in a specific direction.
 */
export interface EntityPlacement {
    /** Fractional index in river path. */
    index: number;
    /** Center and radius */
    x: number, z: number, radius: number;
    /** Spawner */
    config: EntitySpawnConfig;
};

export type PlacementPredicate = (ctx: EntityGeneratorContext, radius: number) => boolean;

export class EntityRules {
    public static choose(types: EntityGeneratorFn[]) {
        return (ctx: EntityGeneratorContext) => {
            const type = types[Math.floor(Math.random() * types.length)];
            return type(ctx);
        }
    }

    public static all(predicates: PlacementPredicate[]): PlacementPredicate {
        return (ctx: EntityGeneratorContext, radius: number) => {
            for (const p of predicates) {
                if (!p(ctx, radius)) return false;
            }
            return true;
        };
    }

    public static select(choice: { water?: PlacementPredicate, land?: PlacementPredicate }): PlacementPredicate {
        return (ctx: EntityGeneratorContext, radius: number) => {
            if (ctx.habitat === 'water' && choice.water !== undefined) {
                return choice.water(ctx, radius);
            } else if (ctx.habitat === 'land' && choice.land !== undefined) {
                return choice.land(ctx, radius);
            }
            return false;
        }
    }

    public static true(): PlacementPredicate {
        return (ctx: EntityGeneratorContext, radius: number) => true;
    }

    public static slope_in_range(min: number, max: number): PlacementPredicate {
        return (ctx: EntityGeneratorContext, radius: number) => {
            const normal = ctx.riverSystem.terrainGeometry.calculateNormal(ctx.x, ctx.z);
            const up = new THREE.Vector3(0, 1, 0);
            const angleRad = normal.angleTo(up);
            const angleDeg = angleRad * 180 / Math.PI;
            return (min <= angleDeg && angleDeg <= max);
        };
    }

    public static min_bank_distance(min: number): PlacementPredicate {
        return (ctx: EntityGeneratorContext, radius: number) => {
            return Math.abs(Math.abs(ctx.offset) - ctx.sample.bankDist) > radius + min;
        }
    }
}
