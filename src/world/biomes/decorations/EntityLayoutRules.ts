import * as THREE from 'three'
import { EntityIds } from "../../../entities/EntityIds";
import { AnimalSpawner, AnimalSpawnOptions } from "../../../entities/spawners/AnimalSpawner";
import { RiverGeometrySample } from "../../RiverGeometry";
import { EntityMetadata } from "../../../entities/EntityMetadata";
import { AnimalBehaviorConfig } from "../../../entities/behaviors/AnimalBehaviorConfigs";
import { SpawnContext } from "../../../entities/Spawnable";
import { RiverSystem } from "../../RiverSystem";
import { BiomeType } from '../BiomeType';
import { Alligator, Bluebird, BrownBear, Butterfly, Hippo } from '../../../entities/obstacles';
import { Swan } from '../../../entities/obstacles/Swan';
import { PolarBear } from '../../../entities/obstacles/PolarBear';
import { Moose } from '../../../entities/obstacles/Moose';
import { Duckling } from '../../../entities/obstacles/Duckling';
import { PenguinKayak } from '../../../entities/obstacles/PenguinKayak';
import { TRex } from '../../../entities/obstacles/TRex';
import { Triceratops } from '../../../entities/obstacles/Triceratops';
import { Brontosaurus } from '../../../entities/obstacles/Brontosaurus';
import { Snake } from '../../../entities/obstacles/Snake';
import { Egret } from '../../../entities/obstacles/Egret';
import { Dolphin } from '../../../entities/obstacles/Dolphin';
import { Turtle } from '../../../entities/obstacles/Turtle';
import { GingerMan } from '../../../entities/obstacles/GingerMan';
import { Monkey } from '../../../entities/obstacles/Monkey';
import { WaterGrassSpawner } from '../../../entities/spawners/WaterGrassSpawner';
import { DecorationId, Decorations } from '../../Decorations';
import { AnimalClass } from '../../../entities/obstacles/Animal';
import { PhysicsEngine } from '../../../core/PhysicsEngine';
import { Unicorn } from '../../../entities/obstacles/Unicorn';
import { Dragonfly } from '../../../entities/obstacles/Dragonfly';
import { Pterodactyl } from '../../../entities/obstacles/Pterodactyl';
import { LillyPadPatchSpawner } from '../../../entities/spawners/LillyPadPatchSpawner';
import { RockSpawner } from '../../../entities/spawners/RockSpawner';
import { MessageInABottleSpawner } from '../../../entities/spawners/MessageInABottleSpawner';
import { MangroveSpawner } from '../../../entities/spawners/MangroveSpawner';
import { PierSpawner } from '../../../entities/spawners/PierSpawner';
import { BuoySpawner } from '../../../entities/spawners/BuoySpawner';
import { LogSpawner } from '../../../entities/spawners/LogSpawner';

export type Habitat = 'land' | 'water' | 'any';

/**
 * Represents a point on the boat path, extending the basic river geometry
 * with a boat-specific X offset for weaving.
 */
export interface PathPoint extends RiverGeometrySample {
    /** Offset from river center along the normal vector (negative is left, positive is right) */
    boatXOffset: number;
}

/**
 * EntityGeneratorFn is called with context to generate a set of placement
 * options.
 */
export interface EntityGeneratorContext {
    sample: PathPoint;
    offset: number;
    habitat: Habitat;
    progress: number,
    biomeZRange: [number, number]
};

export type EntityGeneratorFn = (ctx: EntityGeneratorContext) =>
    EntityPlacementOptions | null;


/**
 * Placement options include a spawn config for instantiating an entity.
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

export class AnimalSpawnConfig extends EntitySpawnConfig {
    constructor(
        public id: EntityIds,
        public factory: AnimalClass,
        public decorationIds: DecorationId[] = []
    ) {
        super();
        this.decorationIds = decorationIds;
    }

    public spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number
    ) {
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;

        const animal = options as AnimalPlacementOptions;
        const animalClass = this.factory;
        if (!animalClass) return;

        const riverSystem = RiverSystem.getInstance();
        const isWater = Math.abs(offset) <= sample.bankDist;

        if (isWater) {
            AnimalSpawner.createEntity(animalClass, context,
                x, z, Math.random() * Math.PI * 2,
                animal.heightInWater, new THREE.Vector3(0, 1, 0),
                animal.options);
        } else {
            const terrainHeight = riverSystem.terrainGeometry.calculateHeight(x, z);
            const terrainNormal = riverSystem.terrainGeometry.calculateNormal(x, z);

            AnimalSpawner.createEntity(animalClass, context,
                x, z, Math.random() * Math.PI * 2,
                terrainHeight, terrainNormal,
                animal.options);
        }
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        if (this.decorationIds) {
            yield* Decorations.ensureAllLoaded(this.decorationIds);
        }
    }
}

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
    id = EntityIds.ROCK;

    override spawn(context: SpawnContext, options: EntityPlacementOptions,
        sample: RiverGeometrySample, offset: number) {
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;
        LogSpawner.createEntity(context, x, z, options.radius * 2);
    }
};

/**
 * Placement options describe a candidate entity placement.
 */
export interface EntityPlacementOptions {
    radius: number;
    config: EntitySpawnConfig;
};

export interface RockPlacementOptions extends EntityPlacementOptions {
    biomeType: BiomeType;
};

export interface PierPlacementOptions extends EntityPlacementOptions {
    forceDepot: boolean;
};

export interface AnimalPlacementOptions extends EntityPlacementOptions {
    heightInWater: number;
    options: AnimalSpawnOptions;
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

    public static alligator() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.alligator.radius,
                config: this.alligator_config,
                heightInWater: Alligator.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat)
                }
            };
        }
    }

    private static alligator_config = new AnimalSpawnConfig(EntityIds.ALLIGATOR, Alligator, ['alligator']);

    public static swamp_gator() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            if (!(-10 <= ctx.offset && ctx.offset < 10)) return null;
            return {
                radius: EntityMetadata.alligator.radius,
                config: this.alligator_config,
                heightInWater: Alligator.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'attack', logicName: 'AmbushAttack' }
                }
            }
        };
    }

    public static hippo() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.hippo.radius,
                config: this.hippo_config,
                heightInWater: Hippo.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat)
                }
            };
        }
    }

    private static hippo_config = new AnimalSpawnConfig(EntityIds.HIPPO, Hippo, ['hippo']);

    public static swan() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.swan.radius,
                config: this.swan_config,
                heightInWater: Swan.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'swim' }
                }
            };
        }
    }

    private static swan_config = new AnimalSpawnConfig(EntityIds.SWAN, Swan, ['swan']);

    public static unicorn() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'land') return null;
            return {
                radius: EntityMetadata.unicorn.radius,
                config: this.unicorn_config,
                heightInWater: 0,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'unicorn' }
                }
            };
        }
    }

    private static unicorn_config = new AnimalSpawnConfig(EntityIds.UNICORN, Unicorn, ['unicorn']);

    public static bluebird() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'land') return null;
            return {
                radius: EntityMetadata.bluebird.radius,
                config: this.bluebird_config,
                heightInWater: 0,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'none' }    // ignored
                }
            };
        }
    }

    private static bluebird_config = new AnimalSpawnConfig(EntityIds.BLUEBIRD, Bluebird, ['bluebird']);

    public static brown_bear() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.brownBear.radius,
                config: this.brown_bear_config,
                heightInWater: BrownBear.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat, 'WolfAttack')
                }
            };
        }
    }

    private static brown_bear_config = new AnimalSpawnConfig(EntityIds.BROWN_BEAR, BrownBear, ['brownBear']);

    public static polar_bear() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.polar_bear.radius,
                config: this.polar_bear_config,
                heightInWater: PolarBear.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat, 'WolfAttack')
                }
            };
        }
    }

    private static polar_bear_config = new AnimalSpawnConfig(EntityIds.POLAR_BEAR, PolarBear, ['polarBear']);

    public static moose() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.moose.radius,
                config: this.moose_config,
                heightInWater: Moose.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat, 'WolfAttack')
                }
            };
        }
    }

    private static moose_config = new AnimalSpawnConfig(EntityIds.MOOSE, Moose, ['moose']);

    public static duckling() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.duckling.radius,
                config: this.duckling_config,
                heightInWater: Duckling.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'swim' }
                }
            };
        }
    }

    private static duckling_config = new AnimalSpawnConfig(EntityIds.DUCKLING, Duckling, ['duckling']);

    public static penguin_kayak() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.penguin_kayak.radius,
                config: this.penguin_kayak_config,
                heightInWater: PenguinKayak.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'swim' }
                }
            };
        }
    }

    private static penguin_kayak_config = new AnimalSpawnConfig(EntityIds.PENGUIN_KAYAK, PenguinKayak, ['penguinKayak']);

    public static dragonfly() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.dragonfly.radius,
                config: this.dragonfly_config,
                heightInWater: 0,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'none' }    // ignored
                }
            };
        }
    }

    private static dragonfly_config = new AnimalSpawnConfig(EntityIds.DRAGONFLY, Dragonfly, ['dragonfly']);

    public static trex() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.trex.radius,
                config: this.trex_config,
                heightInWater: TRex.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat, 'WolfAttack')
                }
            };
        }
    }

    private static trex_config = new AnimalSpawnConfig(EntityIds.TREX, TRex, ['trex']);

    public static triceratops() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.triceratops.radius,
                config: this.triceratops_config,
                heightInWater: Triceratops.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat, 'WolfAttack')
                }
            };
        }
    }

    private static triceratops_config = new AnimalSpawnConfig(EntityIds.TRICERATOPS, Triceratops, ['triceratops']);

    public static brontosaurus() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.brontosaurus.radius,
                config: this.brontosaurus_config,
                heightInWater: Brontosaurus.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_wait_attack(ctx.habitat, 'WolfAttack')
                }
            };
        }
    }

    private static brontosaurus_config = new AnimalSpawnConfig(EntityIds.BRONTOSAURUS, Brontosaurus, ['brontosaurus']);

    public static pterodactyl() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.pterodactyl.radius,
                config: this.pterodactyl_config,
                heightInWater: 0,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'none' }    // ignored
                }
            };
        }
    }

    private static pterodactyl_config = new AnimalSpawnConfig(EntityIds.PTERODACTYL, Pterodactyl, ['pterodactyl']);

    public static snake() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.snake.radius,
                config: this.snake_config,
                heightInWater: Snake.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'attack', logicName: 'WolfAttack' }
                }
            };
        }
    }

    private static snake_config = new AnimalSpawnConfig(EntityIds.SNAKE, Snake, ['snake']);

    public static egret() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.egret.radius,
                config: this.egret_config,
                heightInWater: Egret.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'none' }    // ignored
                }
            };
        }
    }

    private static egret_config = new AnimalSpawnConfig(EntityIds.EGRET, Egret, ['egret']);

    public static dolphin() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'water') return null;
            return {
                radius: EntityMetadata.dolphin.radius,
                config: this.dolphin_config,
                heightInWater: Dolphin.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'swim' }
                }
            };
        }
    }

    private static dolphin_config = new AnimalSpawnConfig(EntityIds.DOLPHIN, Dolphin, ['dolphin']);

    public static turtle() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.turtle.radius,
                config: this.turtle_config,
                heightInWater: Turtle.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: ctx.habitat === 'land' ? { type: 'wait-swim' } : { type: 'swim' }
                }
            };
        }
    }

    private static turtle_config = new AnimalSpawnConfig(EntityIds.TURTLE, Turtle, ['turtle']);

    public static butterfly() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            if (ctx.habitat !== 'land') return null;
            return {
                radius: EntityMetadata.butterfly.radius,
                config: this.butterfly_config,
                heightInWater: 0,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'none' }    // ignored
                }
            };
        }
    }

    private static butterfly_config = new AnimalSpawnConfig(EntityIds.BUTTERFLY, Butterfly, ['butterfly']);

    public static gingerman() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.gingerman.radius,
                config: this.gingerman_config,
                heightInWater: GingerMan.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: { type: 'walk-attack', logicName: 'WolfAttack' }
                }
            }
        }
    }

    private static gingerman_config = new AnimalSpawnConfig(EntityIds.GINGERMAN, GingerMan, ['gingerman']);

    public static monkey() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions | null => {
            return {
                radius: EntityMetadata.monkey.radius,
                config: this.monkey_config,
                heightInWater: Monkey.HEIGHT_IN_WATER,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior_walk_attack(ctx.habitat),
                }
            }
        }
    }

    private static monkey_config = new AnimalSpawnConfig(EntityIds.MONKEY, Monkey, ['monkey']);

    private static aggressiveness(ctx: EntityGeneratorContext): number {
        const aggressiveness = Math.min(1.0, ctx.progress * 0.7 + Math.random() * 0.3);
        return aggressiveness;
    }

    private static behavior_wait_attack(
        habitat: Habitat,
        logicName?: 'WolfAttack' | 'AmbushAttack'
    ): AnimalBehaviorConfig {
        if (logicName === undefined)
            logicName = Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack';
        if (habitat === 'water') {
            return { type: 'attack', logicName }
        } else {
            return { type: 'wait-attack', logicName }
        }
    }

    private static behavior_walk_attack(
        habitat: Habitat,
        logicName?: 'WolfAttack' | 'AmbushAttack'
    ): AnimalBehaviorConfig {
        if (logicName === undefined)
            logicName = Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack';
        if (habitat === 'water') {
            return { type: 'attack', logicName }
        } else {
            return { type: 'walk-attack', logicName }
        }
    }
}
