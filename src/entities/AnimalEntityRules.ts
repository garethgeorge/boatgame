import * as THREE from 'three';
import { EntityIds } from "./EntityIds";
import { AnimalSpawner, AnimalSpawnOptions } from "./spawners/AnimalSpawner";
import { RiverGeometrySample } from "../world/RiverGeometry";
import { EntityMetadata } from "./EntityMetadata";
import { AnimalBehaviorConfig } from "./behaviors/AnimalBehaviorConfigs";
import { PopulationContext } from "../world/biomes/PopulationContext";
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
import { Habitat, EntityGeneratorContext, EntitySpawnConfig, EntityPlacement, PlacementPredicate, EntityRules } from '../world/biomes/decorations/EntityLayoutRules';

export interface AnimalPlacement extends EntityPlacement {
    habitat: Habitat;
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

    public spawn(context: PopulationContext, options: EntityPlacement,
        sample: RiverGeometrySample
    ) {
        const x = options.x;
        const z = options.z;

        const animal = options as AnimalPlacement;
        const animalClass = this.factory;
        if (!animalClass) return;

        const riverSystem = RiverSystem.getInstance();

        if (animal.habitat === 'water') {
            AnimalSpawner.createEntity(animalClass, context,
                x, z, Math.random() * Math.PI * 2,
                animal.heightInWater, new THREE.Vector3(0, 1, 0),
                animal.options);
        } else {
            const terrainHeight = riverSystem.terrainGeometry.calculateHeight(x, z);
            const terrainNormal = riverSystem.terrainGeometry.calculateNormal(x, z);

            // Calculate rotation (facing the river)
            const d = x < sample.centerPos.x ? -1 : 1;
            const riverAngle = Math.atan2(sample.tangent.x, sample.tangent.z);
            // d < 0 is left bank, should face right (PI/2)
            // d > 0 is right bank, should face left (-PI/2)
            let rotation = (d > 0) ? Math.PI / 2 : -Math.PI / 2;
            rotation += riverAngle;
            rotation += (Math.random() - 0.5) * (Math.PI / 4);

            AnimalSpawner.createEntity(animalClass, context,
                x, z, rotation,
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

class Rules {
    public alligator(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.alligator.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private alligator_config = new AnimalSpawnConfig(EntityIds.ALLIGATOR, Alligator, ['alligator']);

    public swamp_gator() {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.alligator.radius;
            if (ctx.habitat !== 'water') return null;
            if (!(-10 <= ctx.offset && ctx.offset < 10)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    public hippo(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.hippo.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private hippo_config = new AnimalSpawnConfig(EntityIds.HIPPO, Hippo, ['hippo']);

    public swan(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.swan.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private swan_config = new AnimalSpawnConfig(EntityIds.SWAN, Swan, ['swan']);

    public unicorn(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.unicorn.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private unicorn_config = new AnimalSpawnConfig(EntityIds.UNICORN, Unicorn, ['unicorn']);

    public bluebird(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.bluebird.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private bluebird_config = new AnimalSpawnConfig(EntityIds.BLUEBIRD, Bluebird, ['bluebird']);

    public brown_bear(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.brownBear.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private brown_bear_config = new AnimalSpawnConfig(EntityIds.BROWN_BEAR, BrownBear, ['brownBear']);

    public polar_bear(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.polarBear.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private polar_bear_config = new AnimalSpawnConfig(EntityIds.POLAR_BEAR, PolarBear, ['polarBear']);

    public moose(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.moose.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private moose_config = new AnimalSpawnConfig(EntityIds.MOOSE, Moose, ['moose']);

    public duckling(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.duckling.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private duckling_config = new AnimalSpawnConfig(EntityIds.DUCKLING, Duckling, ['duckling']);

    public penguin_kayak(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.penguinKayak.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private penguin_kayak_config = new AnimalSpawnConfig(EntityIds.PENGUIN_KAYAK, PenguinKayak, ['penguinKayak']);

    public dragonfly(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.dragonfly.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private dragonfly_config = new AnimalSpawnConfig(EntityIds.DRAGONFLY, Dragonfly, ['dragonfly']);

    public trex(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.trex.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private trex_config = new AnimalSpawnConfig(EntityIds.TREX, TRex, ['trex']);

    public triceratops(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.triceratops.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private triceratops_config = new AnimalSpawnConfig(EntityIds.TRICERATOPS, Triceratops, ['triceratops']);

    public brontosaurus(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.brontosaurus.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private brontosaurus_config = new AnimalSpawnConfig(EntityIds.BRONTOSAURUS, Brontosaurus, ['brontosaurus']);

    public pterodactyl(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.pterodactyl.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private pterodactyl_config = new AnimalSpawnConfig(EntityIds.PTERODACTYL, Pterodactyl, ['pterodactyl']);

    public snake(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.snake.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private snake_config = new AnimalSpawnConfig(EntityIds.SNAKE, Snake, ['snake']);

    public egret(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.egret.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private egret_config = new AnimalSpawnConfig(EntityIds.EGRET, Egret, ['egret']);

    public dolphin(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.dolphin.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private dolphin_config = new AnimalSpawnConfig(EntityIds.DOLPHIN, Dolphin, ['dolphin']);

    public turtle(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.turtle.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private turtle_config = new AnimalSpawnConfig(EntityIds.TURTLE, Turtle, ['turtle']);

    public butterfly(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.butterfly.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private butterfly_config = new AnimalSpawnConfig(EntityIds.BUTTERFLY, Butterfly, ['butterfly']);

    public gingerman(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.gingerman.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private gingerman_config = new AnimalSpawnConfig(EntityIds.GINGERMAN, GingerMan, ['gingerman']);

    public monkey(predicate: PlacementPredicate) {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = EntityMetadata.monkey.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
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

    private monkey_config = new AnimalSpawnConfig(EntityIds.MONKEY, Monkey, ['monkey']);

    private aggressiveness(ctx: EntityGeneratorContext): number {
        const aggressiveness = Math.min(1.0, ctx.progress * 0.7 + Math.random() * 0.3);
        return aggressiveness;
    }

    private behavior_wait_attack(
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

    private behavior_walk_attack(
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

///////////

export class AnimalEntityRules {

    private static defaultPredicate =
        EntityRules.all([
            EntityRules.min_bank_distance(1.0),
            EntityRules.select({
                land: EntityRules.slope_in_range(0, 20),
                water: EntityRules.true()
            })
        ]);

    private static landPredicate =
        EntityRules.all([
            EntityRules.min_bank_distance(1.0),
            EntityRules.select({
                land: EntityRules.slope_in_range(0, 20),
            })
        ]);

    private static waterPredicate =
        EntityRules.all([
            EntityRules.min_bank_distance(1.0),
            EntityRules.select({
                water: EntityRules.true()
            })
        ]);

    private static rules: Rules = null;

    private static get(): Rules {
        if (!this.rules) this.rules = new Rules;
        return this.rules;
    }

    public static alligator(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().alligator(predicate);
    }

    public static swamp_gator() {
        return this.get().swamp_gator();
    }

    public static hippo(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().hippo(predicate);
    }

    public static swan(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().swan(predicate);
    }

    public static unicorn(predicate: PlacementPredicate = this.landPredicate) {
        return this.get().unicorn(predicate);
    }

    public static bluebird(predicate: PlacementPredicate = this.landPredicate) {
        return this.get().bluebird(predicate);
    }

    public static brown_bear(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().brown_bear(predicate);
    }

    public static polar_bear(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().polar_bear(predicate);
    }

    public static moose(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().moose(predicate);
    }

    public static duckling(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().duckling(predicate);
    }

    public static penguin_kayak(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().penguin_kayak(predicate);
    }

    public static dragonfly(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().dragonfly(predicate);
    }

    public static trex(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().trex(predicate);
    }

    public static triceratops(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().triceratops(predicate);
    }

    public static brontosaurus(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().brontosaurus(predicate);
    }

    public static pterodactyl(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().pterodactyl(predicate);
    }

    public static snake(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().snake(predicate);
    }

    public static egret(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().egret(predicate);
    }

    public static dolphin(predicate: PlacementPredicate = this.waterPredicate) {
        return this.get().dolphin(predicate);
    }

    public static turtle(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().turtle(predicate);
    }

    public static butterfly(predicate: PlacementPredicate = this.landPredicate) {
        return this.get().butterfly(predicate);
    }

    public static gingerman(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().gingerman(predicate);
    }

    public static monkey(predicate: PlacementPredicate = this.defaultPredicate) {
        return this.get().monkey(predicate);
    }
}
