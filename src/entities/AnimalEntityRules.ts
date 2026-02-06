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
import { Decorations, DecorationId } from '../world/decorations/Decorations';
import {
    Habitat, EntityGeneratorContext, EntitySpawnConfig,
    EntityPlacement, PlacementPredicate, EntityRules,
    EntityGeneratorFn
} from '../world/layout/EntityLayoutRules';

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

class Details {
    protected static defaultPredicate =
        EntityRules.all([
            EntityRules.min_bank_distance(1.0),
            EntityRules.select({
                land: EntityRules.slope_in_range(0, 20),
                water: EntityRules.true()
            })
        ]);

    protected static landPredicate =
        EntityRules.all([
            EntityRules.min_bank_distance(1.0),
            EntityRules.select({
                land: EntityRules.slope_in_range(0, 20),
            })
        ]);

    protected static waterPredicate =
        EntityRules.all([
            EntityRules.min_bank_distance(1.0),
            EntityRules.select({
                water: EntityRules.true()
            })
        ]);

    protected aggressiveness(ctx: EntityGeneratorContext): number {
        const aggressiveness = Math.min(1.0, ctx.progress * 0.7 + Math.random() * 0.3);
        return aggressiveness;
    }

    protected behavior_wait_attack(
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

    protected behavior_walk_attack(
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

abstract class AnimalRule extends Details {
    private config: AnimalSpawnConfig;
    private radius: number;
    private heightInWater: number;

    constructor(config: AnimalSpawnConfig, radius: number, heightInWater: number) {
        super();
        this.config = config;
        this.radius = radius;
        this.heightInWater = heightInWater;
    }

    protected abstract behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig;

    public get(predicate: PlacementPredicate): EntityGeneratorFn {
        return (ctx: EntityGeneratorContext): AnimalPlacement | null => {
            const radius = this.radius;
            if (predicate !== undefined && !predicate(ctx, radius)) return null;
            return {
                index: ctx.index, x: ctx.x, z: ctx.z, radius: radius, habitat: ctx.habitat,
                config: this.config,
                heightInWater: this.heightInWater,
                options: {
                    aggressiveness: this.aggressiveness(ctx),
                    biomeZRange: ctx.biomeZRange,
                    behavior: this.behavior(ctx)
                }
            };
        }
    }
}

export class AlligatorRule extends AnimalRule {
    private static _instance: AlligatorRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new AlligatorRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.ALLIGATOR, Alligator, ['alligator']),
            EntityMetadata.alligator.radius,
            Alligator.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat);
    }
}

export class HippoRule extends AnimalRule {
    private static _instance: HippoRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new HippoRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.HIPPO, Hippo, ['hippo']),
            EntityMetadata.hippo.radius,
            Hippo.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat);
    }
}

export class SwanRule extends AnimalRule {
    private static _instance: SwanRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new SwanRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.SWAN, Swan, ['swan']),
            EntityMetadata.swan.radius,
            Swan.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class UnicornRule extends AnimalRule {
    private static _instance: UnicornRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.landPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new UnicornRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.UNICORN, Unicorn, ['unicorn']),
            EntityMetadata.unicorn.radius,
            0
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'unicorn' };
    }
}

export class BluebirdRule extends AnimalRule {
    private static _instance: BluebirdRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.landPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new BluebirdRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.BLUEBIRD, Bluebird, ['bluebird']),
            EntityMetadata.bluebird.radius,
            0
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
    }
}

export class BrownBearRule extends AnimalRule {
    private static _instance: BrownBearRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new BrownBearRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.BROWN_BEAR, BrownBear, ['brownBear']),
            EntityMetadata.brownBear.radius,
            BrownBear.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class PolarBearRule extends AnimalRule {
    private static _instance: PolarBearRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new PolarBearRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.POLAR_BEAR, PolarBear, ['polarBear']),
            EntityMetadata.polarBear.radius,
            PolarBear.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class MooseRule extends AnimalRule {
    private static _instance: MooseRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new MooseRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.MOOSE, Moose, ['moose']),
            EntityMetadata.moose.radius,
            Moose.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class DucklingRule extends AnimalRule {
    private static _instance: DucklingRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new DucklingRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.DUCKLING, Duckling, ['duckling']),
            EntityMetadata.duckling.radius,
            Duckling.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class PenguinKayakRule extends AnimalRule {
    private static _instance: PenguinKayakRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new PenguinKayakRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.PENGUIN_KAYAK, PenguinKayak, ['penguinKayak']),
            EntityMetadata.penguinKayak.radius,
            PenguinKayak.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class DragonflyRule extends AnimalRule {
    private static _instance: DragonflyRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new DragonflyRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.DRAGONFLY, Dragonfly, ['dragonfly']),
            EntityMetadata.dragonfly.radius,
            0
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
    }
}

export class TRexRule extends AnimalRule {
    private static _instance: TRexRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new TRexRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.TREX, TRex, ['trex']),
            EntityMetadata.trex.radius,
            TRex.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class TriceratopsRule extends AnimalRule {
    private static _instance: TriceratopsRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new TriceratopsRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.TRICERATOPS, Triceratops, ['triceratops']),
            EntityMetadata.triceratops.radius,
            Triceratops.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class BrontosaurusRule extends AnimalRule {
    private static _instance: BrontosaurusRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new BrontosaurusRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.BRONTOSAURUS, Brontosaurus, ['brontosaurus']),
            EntityMetadata.brontosaurus.radius,
            Brontosaurus.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class PterodactylRule extends AnimalRule {
    private static _instance: PterodactylRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new PterodactylRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.PTERODACTYL, Pterodactyl, ['pterodactyl']),
            EntityMetadata.pterodactyl.radius,
            0
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
    }
}

export class SnakeRule extends AnimalRule {
    private static _instance: SnakeRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new SnakeRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.SNAKE, Snake, ['snake']),
            EntityMetadata.snake.radius,
            Snake.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'attack', logicName: 'WolfAttack' };
    }
}

export class EgretRule extends AnimalRule {
    private static _instance: EgretRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new EgretRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.EGRET, Egret, ['egret']),
            EntityMetadata.egret.radius,
            Egret.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
    }
}

export class DolphinRule extends AnimalRule {
    private static _instance: DolphinRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new DolphinRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.DOLPHIN, Dolphin, ['dolphin']),
            EntityMetadata.dolphin.radius,
            Dolphin.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class TurtleRule extends AnimalRule {
    private static _instance: TurtleRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new TurtleRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.TURTLE, Turtle, ['turtle']),
            EntityMetadata.turtle.radius,
            Turtle.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return ctx.habitat === 'land' ? { type: 'wait-swim' } : { type: 'swim' };
    }
}

export class ButterflyRule extends AnimalRule {
    private static _instance: ButterflyRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.landPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new ButterflyRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.BUTTERFLY, Butterfly, ['butterfly']),
            EntityMetadata.butterfly.radius,
            0
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
    }
}

export class GingerManRule extends AnimalRule {
    private static _instance: GingerManRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new GingerManRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.GINGERMAN, GingerMan, ['gingerman']),
            EntityMetadata.gingerman.radius,
            GingerMan.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return { type: 'walk-swim' };
    }
}

export class MonkeyRule extends AnimalRule {
    private static _instance: MonkeyRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): EntityGeneratorFn {
        if (!this._instance) this._instance = new MonkeyRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            new AnimalSpawnConfig(EntityIds.MONKEY, Monkey, ['monkey']),
            EntityMetadata.monkey.radius,
            Monkey.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: EntityGeneratorContext): AnimalBehaviorConfig {
        return this.behavior_walk_attack(ctx.habitat);
    }
}
