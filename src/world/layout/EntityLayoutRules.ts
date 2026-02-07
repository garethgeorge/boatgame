import * as THREE from 'three';
import { EntityIds } from "../../entities/EntityIds";
import { RiverGeometrySample } from "../RiverGeometry";
import { PopulationContext } from "../biomes/PopulationContext";
import { DecorationId } from '../decorations/Decorations';
import { RiverSystem } from "../RiverSystem";
import { PlacementManifest } from '../../core/SpatialGrid';

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
 * Entity placement describes how to place an instance.
 * index is the fractional index of the river position.
 */
export abstract class EntityPlacement implements PlacementManifest {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly groundRadius: number,
        public readonly canopyRadius: number = 0
    ) { }

    /** The entity ID for telemetry and identity. */
    public abstract get id(): EntityIds;

    /** Spawns the entity into the world. */
    public abstract spawn(context: PopulationContext, sample: RiverGeometrySample): void;

    /** 
     * Generator that yields promises for assets that must be loaded 
     * before this entity can be spawned.
     */
    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        // Default: nothing to load
    }
}


export type PlacementPredicate = (ctx: EntityGeneratorContext, groundRadius: number) => boolean;

export class EntityRules {
    public static choose(types: EntityGeneratorFn[]) {
        return (ctx: EntityGeneratorContext) => {
            const type = types[Math.floor(Math.random() * types.length)];
            return type(ctx);
        }
    }

    public static all(predicates: PlacementPredicate[]): PlacementPredicate {
        return (ctx: EntityGeneratorContext, groundRadius: number) => {
            for (const p of predicates) {
                if (!p(ctx, groundRadius)) return false;
            }
            return true;
        };
    }

    public static select(choice: { water?: PlacementPredicate, land?: PlacementPredicate }): PlacementPredicate {
        return (ctx: EntityGeneratorContext, groundRadius: number) => {
            if (ctx.habitat === 'water' && choice.water !== undefined) {
                return choice.water(ctx, groundRadius);
            } else if (ctx.habitat === 'land' && choice.land !== undefined) {
                return choice.land(ctx, groundRadius);
            }
            return false;
        }
    }

    public static true(): PlacementPredicate {
        return (ctx: EntityGeneratorContext, groundRadius: number) => true;
    }

    public static slope_in_range(min: number, max: number): PlacementPredicate {
        return (ctx: EntityGeneratorContext, groundRadius: number) => {
            const normal = ctx.riverSystem.terrainGeometry.calculateNormal(ctx.x, ctx.z);
            const up = new THREE.Vector3(0, 1, 0);
            const angleRad = normal.angleTo(up);
            const angleDeg = angleRad * 180 / Math.PI;
            return (min <= angleDeg && angleDeg <= max);
        };
    }

    public static min_bank_distance(min: number): PlacementPredicate {
        return (ctx: EntityGeneratorContext, groundRadius: number) => {
            return Math.abs(Math.abs(ctx.offset) - ctx.sample.bankDist) > groundRadius + min;
        }
    }
}
