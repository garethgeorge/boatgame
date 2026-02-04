import { EntityIds } from "./EntityIds";
import { RiverGeometrySample } from "../world/RiverGeometry";
import { EntityMetadata } from "./EntityMetadata";
import { PopulationContext } from "../world/biomes/PopulationContext";
import { BiomeType } from '../world/biomes/BiomeType';
import { WaterGrassSpawner } from './spawners/WaterGrassSpawner';
import { LillyPadPatchSpawner } from './spawners/LillyPadPatchSpawner';
import { RockSpawner } from './spawners/RockSpawner';
import { MessageInABottleSpawner } from './spawners/MessageInABottleSpawner';
import { MangroveSpawner } from './spawners/MangroveSpawner';
import { PierSpawner } from './spawners/PierSpawner';
import { BuoySpawner } from './spawners/BuoySpawner';
import { LogSpawner } from './spawners/LogSpawner';
import { EntitySpawnConfig, EntityPlacement, EntityGeneratorContext, PlacementPredicate, EntityRules } from '../world/biomes/decorations/EntityLayoutRules';
import { IcebergSpawner } from "./spawners/IcebergSpawner";

export interface BuoyPlacement extends EntityPlacement {
    offset: number;
};

class BuoySpawnConfig extends EntitySpawnConfig {
    id = EntityIds.BUOY;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        const opts = options as BuoyPlacement;
        const radius = opts.radius;
        const offset = opts.offset;
        BuoySpawner.createEntity(context, sample, [offset - radius, offset + radius]);
    }
}

export interface PierPlacement extends EntityPlacement {
    angle: number;
    hasDepot: boolean;
};

class PierSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.PIER;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        const opts = options as PierPlacement;
        PierSpawner.createEntity(
            context, opts.x, opts.z, opts.radius * 2, opts.angle, opts.hasDepot);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* PierSpawner.ensureLoaded();
    }
}

export interface IcebergPlacement extends EntityPlacement {
    hasBear: boolean;
};

class IcebergSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.ICEBERG;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        const opts = options as IcebergPlacement;
        IcebergSpawner.createEntity(context, options.x, options.z, options.radius, opts.hasBear);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* IcebergSpawner.ensureLoaded();
    }
}

export interface MangrovePlacement extends EntityPlacement {
    size: number;
}

class MangroveSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.MANGROVE;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        const opts = options as MangrovePlacement;
        MangroveSpawner.createEntity(context, options.x, options.z, opts.size);
    }
}

export interface PatchPlacement extends EntityPlacement {
    width: number;
    length: number;
};

class LilyPadPatchSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.LILLY_PAD_PATCH;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        const opts = options as PatchPlacement;
        LillyPadPatchSpawner.createEntity(context, options.x, options.z,
            opts.width, opts.length, sample.tangent);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* LillyPadPatchSpawner.ensureLoaded();
    }
}

class WaterGrassSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.WATER_GRASS;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        const opts = options as PatchPlacement;
        WaterGrassSpawner.createEntity(context, options.x, options.z,
            opts.width, opts.length, sample.tangent);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* WaterGrassSpawner.ensureLoaded();
    }
}

class BottleSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.BOTTLE;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        MessageInABottleSpawner.createEntity(context, options.x, options.z);
    }
};

export interface RockPlacement extends EntityPlacement {
    biomeType: BiomeType;
};

class RockSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.ROCK;

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        const opts = options as RockPlacement;

        let pillars = false;
        if (opts.biomeType === 'forest') pillars = Math.random() < 0.1;
        else if (opts.biomeType === 'desert') pillars = Math.random() < 0.3;

        RockSpawner.createEntity(
            context, options.x, options.z, options.radius, pillars, opts.biomeType
        );
    }
};

class LogSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.ROCK; // Note: Original code had ROCK here, keeping for consistency but it might be a bug.

    override spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample) {
        LogSpawner.createEntity(context, options.x, options.z, options.radius * 2);
    }
};

export class StaticEntityRules {
    private static waterPredicate = EntityRules.all([
        EntityRules.min_bank_distance(0.0),
        EntityRules.select({ water: EntityRules.true() })
    ]);

    // used for pier, assumes its always placed at water edge
    private static shorePredicate = EntityRules.all([
        EntityRules.select({ water: EntityRules.true() })
    ]);

    public static bottle(predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): EntityPlacement | null => {
            const radius = EntityMetadata.messageInABottle.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                config: this.bottle_config
            };
        }
    }

    private static bottle_config = new BottleSpawnConfig;

    public static rock(biomeType: BiomeType, predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): RockPlacement | null => {
            const radius = 1.5 + Math.random() * 3.0; // 1.5 to 4.5m
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                biomeType: biomeType,
                config: this.rock_config,
            };
        }
    }

    private static rock_config = new RockSpawnConfig();

    public static log(predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): EntityPlacement | null => {
            const length = 10 + Math.random() * 10;
            const radius = length / 2;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                config: this.log_config
            };
        }
    }

    private static log_config = new LogSpawnConfig();

    public static buoy(predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): BuoyPlacement | null => {
            // Pick a random length 30-50% width
            const chainLength = (0.3 + Math.random() * 0.2) * ctx.sample.bankDist * 2;
            const radius = chainLength / 2;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                offset: ctx.offset,
                config: this.buoy_config,
            };
        }
    }

    private static buoy_config = new BuoySpawnConfig();

    public static pier(forceDepot: boolean = false, predicate: PlacementPredicate = this.shorePredicate) {
        return (ctx: EntityGeneratorContext): PierPlacement | null => {

            const width = 2 * ctx.sample.bankDist;
            const maxPierLength = Math.min(30, width * 0.6);

            const minDepotPierLength = 13.0;
            const minPierLength = Math.max(forceDepot ? minDepotPierLength : 0, width * 0.2);

            let pierLength = minPierLength + Math.random() * (maxPierLength - minPierLength);

            const radius = pierLength / 2;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;

            const hasDepot = forceDepot ?
                forceDepot : (pierLength > minDepotPierLength && Math.random() > 0.5);

            // calculate pier direction
            const dir = ctx.offset < 0 ? 1 : -1;
            const xDir = dir * ctx.sample.normal.x;
            const zDir = dir * ctx.sample.normal.z;
            const angle = Math.atan2(zDir, xDir);

            const xBank = ctx.sample.centerPos.x - xDir * (ctx.sample.bankDist + 2);
            const zBank = ctx.sample.centerPos.z - zDir * (ctx.sample.bankDist + 2);

            const x = xBank + xDir * radius;
            const z = zBank + zDir * radius;

            return {
                index: ctx.index, x: x, z: z, radius: radius,
                angle: angle,
                hasDepot: hasDepot,
                config: this.pier_config
            };
        }
    }

    private static pier_config = new PierSpawnConfig();

    public static iceberg(predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): IcebergPlacement | null => {

            let scale = 4.0 + Math.random();
            let hasBear = false;
            const r = Math.random();
            if (r < 0.05) {
                scale = 3.0;
                hasBear = Math.random() < 0.5;
            } else if (r < 0.30) {
                scale = 1.5;
            }

            const radius = 4.0 + Math.random() * scale;

            // check predicate
            if (predicate !== undefined && !predicate(ctx, radius)) return null;

            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                hasBear: hasBear,
                config: this.iceberg_config
            };
        }
    }

    private static iceberg_config = new IcebergSpawnConfig();

    public static mangrove(predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): MangrovePlacement | null => {

            // Size Variance
            let baseScale = 1.0;
            const rand = Math.random();
            if (rand < 0.05) {
                baseScale = 2.0;
            } else if (rand < 0.30) {
                baseScale = 1.3;
            }

            // Jitter: +/- 20% (0.8 to 1.2)
            const jitter = 0.8 + Math.random() * 0.4;
            const finalScale = baseScale * jitter;

            // Making size bigger than radius packs more tightly
            const radius = 15.0 * finalScale;
            const size = radius * 1.5;

            if (predicate !== undefined && !predicate(ctx, radius)) return null;

            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                size: size,
                config: this.mangrove_config
            };
        }
    }

    private static mangrove_config = new MangroveSpawnConfig();

    public static lily_pad_patch(predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): PatchPlacement | null => {
            const length = 16.0 + Math.random() * 16.0;
            const width = 16.0 + Math.random() * 16.0;

            const radius = Math.max(width, length) / 2.0;

            if (predicate !== undefined && !predicate(ctx, radius)) return null;

            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                width: width, length: length,
                config: this.lily_pad_patch_config
            };
        }
    }

    private static lily_pad_patch_config = new LilyPadPatchSpawnConfig();

    public static water_grass(predicate: PlacementPredicate = this.waterPredicate) {
        return (ctx: EntityGeneratorContext): PatchPlacement | null => {
            const length = 20.0 + Math.random() * 30.0;
            const width = 10.0 + Math.random() * 15.0;

            // Radius for collision check (approximate as max dimension / 2)
            const radius = Math.max(width, length) / 2.0;

            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius,
                width: width, length: length,
                config: this.water_grass_config
            };
        }
    }

    private static water_grass_config = new WaterGrassSpawnConfig();
}
