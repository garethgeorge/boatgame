import * as THREE from 'three';
import { EntityIds } from "./EntityIds";
import { AnimalSpawner, AnimalSpawnOptions } from "./spawners/AnimalSpawner";
import { RiverGeometrySample } from "../world/RiverGeometry";
import { EntityMetadata } from "./EntityMetadata";
import { AnimalBehaviorConfig } from "./behaviors/AnimalBehaviorConfigs";
import { SpawnContext } from "./SpawnContext";
import { RiverSystem } from "../world/RiverSystem";
import { BiomeType } from '../world/biomes/BiomeType';
import { AnimalClass } from './obstacles/Animal';
import { Alligator } from './obstacles/Alligator';
import { Bluebird } from './obstacles/Bluebird';
import { BrownBear } from './obstacles/BrownBear';
import { Butterfly } from './obstacles/Butterfly';
import { Hippo } from './obstacles/Hippo';
import { Swan } from './obstacles/Swan';
import { PolarBear } from './obstacles/PolarBear';
import { Moose } from './obstacles/Moose';
import { Duckling } from './obstacles/Duckling';
import { PenguinKayak } from './obstacles/PenguinKayak';
import { TRex } from './obstacles/TRex';
import { Triceratops } from './obstacles/Triceratops';
import { Brontosaurus } from './obstacles/Brontosaurus';
import { Snake } from './obstacles/Snake';
import { Egret } from './obstacles/Egret';
import { Dolphin } from './obstacles/Dolphin';
import { Turtle } from './obstacles/Turtle';
import { GingerMan } from './obstacles/GingerMan';
import { Monkey } from './obstacles/Monkey';
import { Unicorn } from './obstacles/Unicorn';
import { Dragonfly } from './obstacles/Dragonfly';
import { Pterodactyl } from './obstacles/Pterodactyl';
import { Decorations, DecorationId } from '../world/Decorations';
import { Habitat, EntityGeneratorContext, EntitySpawnConfig, EntityPlacementOptions } from '../world/biomes/decorations/EntityLayoutRules';

export interface AnimalPlacementOptions extends EntityPlacementOptions {
    heightInWater: number;
    options: AnimalSpawnOptions;
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

    public spawn(context: SpawnContext, options: any,
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
            yield* Decorations.ensureAllLoaded(this.decorationIds as any);
        }
    }
}

export class AnimalEntityRules {
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
