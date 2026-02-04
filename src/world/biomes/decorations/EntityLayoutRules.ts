import { EntityIds } from "../../../entities/EntityIds";
import { RiverGeometrySample } from "../../RiverGeometry";
import { SpawnContext } from "../../../entities/SpawnContext";
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
    offset: number;
    x: number, z: number,
    habitat: Habitat;
    progress: number,
    biomeZRange: [number, number]
};

export type EntityGeneratorFn = (ctx: EntityGeneratorContext) =>
    EntityPlacementOptions | null;


/**
 * The entity description includes a spawn config used to preload and spawn
 * the entity.
 */
export class EntitySpawnConfig {
    public id: EntityIds;
    public decorationIds: DecorationId[] = [];

    public spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    }
};

/**
 * The entity description is comprised of its radius and spawn config.
 */
export interface EntityPlacementOptions {
    radius: number;
    config: EntitySpawnConfig;
};

/**
 * Details for placing a single obstacle instance along the boat path.
 */
export interface EntityPlacement {
    /** Index + fractional offset in the path array */
    index: number;
    /** Distance from river center [-bankDist, bankDist] along the normal vector */
    offset: number;
    /** Options for entity to place */
    entity: EntityPlacementOptions
}

export class EntityRules {
    public static choose(types: EntityGeneratorFn[]) {
        return (ctx: EntityGeneratorContext) => {
            const type = types[Math.floor(Math.random() * types.length)];
            return type(ctx);
        }
    }
}
