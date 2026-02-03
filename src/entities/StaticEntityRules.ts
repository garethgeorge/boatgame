import { EntityIds } from "./EntityIds";
import { RiverGeometrySample } from "../world/RiverGeometry";
import { EntityMetadata } from "./EntityMetadata";
import { SpawnContext } from "./SpawnContext";
import { BiomeType } from '../world/biomes/BiomeType';
import { WaterGrassSpawner } from './spawners/WaterGrassSpawner';
import { LillyPadPatchSpawner } from './spawners/LillyPadPatchSpawner';
import { RockSpawner } from './spawners/RockSpawner';
import { MessageInABottleSpawner } from './spawners/MessageInABottleSpawner';
import { MangroveSpawner } from './spawners/MangroveSpawner';
import { PierSpawner } from './spawners/PierSpawner';
import { BuoySpawner } from './spawners/BuoySpawner';
import { LogSpawner } from './spawners/LogSpawner';
import { EntitySpawnConfig, EntityPlacementOptions, EntityGeneratorContext } from '../world/biomes/decorations/EntityLayoutRules';

export interface RockPlacementOptions extends EntityPlacementOptions {
    biomeType: BiomeType;
};

export interface PierPlacementOptions extends EntityPlacementOptions {
    forceDepot: boolean;
};

class BuoySpawnConfig extends EntitySpawnConfig {
    id = EntityIds.BUOY;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const radius = options.radius;
        BuoySpawner.createEntity(context, sample, [offset - radius, offset + radius]);
    }
}

class PierSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.PIER;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const opts = options as PierPlacementOptions;
        const isLeft = offset < 0;
        PierSpawner.createEntity(
            context, sample.centerPos.z, isLeft, opts.forceDepot);
    }
}

class MangroveSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.MANGROVE;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;
        const scale = options.radius / 4.5;
        MangroveSpawner.createEntity(context, x, z, scale);
    }
}

class LilyPadPatchSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.LILLY_PAD_PATCH;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;
        LillyPadPatchSpawner.createEntity(context, x, z,
            options.radius * 2, options.radius * 2, sample.tangent);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* LillyPadPatchSpawner.ensureLoaded();
    }
}

class WaterGrassSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.WATER_GRASS;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;
        WaterGrassSpawner.createEntity(context, x, z,
            options.radius * 2, options.radius * 2, sample.tangent);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* WaterGrassSpawner.ensureLoaded();
    }
}

class BottleSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.BOTTLE;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;
        MessageInABottleSpawner.createEntity(context, x, z);
    }
};

class RockSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.ROCK;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const opts = options as RockPlacementOptions;
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;

        let pillars = false;
        if (opts.biomeType === 'forest') pillars = Math.random() < 0.1;
        else if (opts.biomeType === 'desert') pillars = Math.random() < 0.3;

        RockSpawner.createEntity(
            context, x, z, options.radius, pillars, opts.biomeType
        );
    }
};

class LogSpawnConfig extends EntitySpawnConfig {
    id = EntityIds.ROCK; // Note: Original code had ROCK here, keeping for consistency but it might be a bug.

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;
        LogSpawner.createEntity(context, x, z, options.radius * 2);
    }
};

export class StaticEntityRules {
    public static bottle() {
        return (ctx: EntityGeneratorContext): EntityPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.bottle.radius,
                config: this.bottle_config
            };
        }
    }

    private static bottle_config = new BottleSpawnConfig;

    public static rock(biomeType: BiomeType) {
        return (ctx: EntityGeneratorContext): RockPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.rock.radius,
                biomeType: biomeType,
                config: this.rock_config,
            };
        }
    }

    private static rock_config = new RockSpawnConfig();

    public static log() {
        return (ctx: EntityGeneratorContext): EntityPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.log.radius,
                config: this.log_config
            };
        }
    }

    private static log_config = new LogSpawnConfig();

    public static buoy() {
        return (ctx: EntityGeneratorContext): EntityPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.buoy.radius,
                config: this.buoy_config
            };
        }
    }

    private static buoy_config = new BuoySpawnConfig();

    public static pier(forceDepot: boolean = false) {
        return (ctx: EntityGeneratorContext): PierPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.pier.radius,
                forceDepot: forceDepot,
                config: this.pier_config
            };
        }
    }

    private static pier_config = new PierSpawnConfig();

    public static mangrove() {
        return (ctx: EntityGeneratorContext): EntityPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.mangrove.radius,
                config: this.mangrove_config
            };
        }
    }

    private static mangrove_config = new MangroveSpawnConfig();

    public static lily_pad_patch() {
        return (ctx: EntityGeneratorContext): EntityPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.lilly_pad_patch.radius,
                config: this.lily_pad_patch_config
            };
        }
    }

    private static lily_pad_patch_config = new LilyPadPatchSpawnConfig();

    public static water_grass() {
        return (ctx: EntityGeneratorContext): EntityPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.water_grass.radius,
                config: this.water_grass_config
            };
        }
    }

    private static water_grass_config = new WaterGrassSpawnConfig();
}
