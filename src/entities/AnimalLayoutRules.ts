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
import { Parrot } from './obstacles/Parrot';
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
import { Narwhal } from './obstacles/Narwhal';
import { Decorations, DecorationId } from '../world/decorations/Decorations';
import { PlacementPredicate, LayoutRules } from '../world/layout/LayoutRuleBuilders';
import { LayoutPlacement } from '../world/layout/LayoutPlacement';
import { LayoutParams, LayoutRule, Habitat, LayoutPlacements, LayoutGenerator } from '../world/layout/LayoutRule';

interface AnimalPlacementParams {
    index: number;
    x: number;
    y: number;
    z: number;
    radius: number;

    habitat: Habitat;
    factory: AnimalClass;
    heightInWater: number;
    options: AnimalSpawnOptions;
    decorationIds?: DecorationId[];
}

export class AnimalPlacement implements LayoutPlacement, LayoutGenerator {
    readonly index: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly radius: number;

    public readonly habitat: Habitat;
    public readonly factory: AnimalClass;
    public readonly heightInWater: number;
    public readonly options: AnimalSpawnOptions;
    public readonly decorationIds: DecorationId[];

    constructor(params: AnimalPlacementParams) {
        this.index = params.index;
        this.x = params.x;
        this.y = params.y;
        this.z = params.z;
        this.radius = params.radius;

        this.habitat = params.habitat;
        this.factory = params.factory;
        this.heightInWater = params.heightInWater;
        this.options = params.options;
        this.decorationIds = params.decorationIds ?? [];
    }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        const x = this.x;
        const z = this.z;

        const animalClass = this.factory;
        if (!animalClass) return;

        const riverSystem = RiverSystem.getInstance();

        if (this.habitat === 'water') {
            AnimalSpawner.createEntity(animalClass, context,
                x, z, Math.random() * Math.PI * 2,
                this.heightInWater, new THREE.Vector3(0, 1, 0),
                this.options);
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
                this.options);
        }
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }

    public *ensureLoaded(loaded: Set<string>): Generator<void | Promise<void>, void, unknown> {
        if (this.decorationIds && this.decorationIds.length > 0) {
            const needed = this.decorationIds.filter(id => !loaded.has(id));
            if (needed.length > 0) {
                yield* Decorations.ensureAllLoaded(needed);
                needed.forEach(id => loaded.add(id));
            }
        }
    }
}

export interface AnimalSlotPlacementParams extends AnimalPlacementParams {
    slotType: string;
    searchRadius: number;
}

/**
 * Specialized animal placement that attempts to find an attachment slot (e.g., a chair)
 * before falling back to standard placement.
 */
export class AnimalSlotPlacement extends AnimalPlacement {
    public readonly slotType: string;
    public readonly searchRadius: number;

    constructor(params: AnimalSlotPlacementParams) {
        super(params);
        this.slotType = params.slotType;
        this.searchRadius = params.searchRadius;
    }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        const slot = context.riverSystem.slots.findNearbySlot(
            this.slotType, this.x, this.z, this.searchRadius);
        if (slot) {
            const animalClass = this.factory;
            if (!animalClass) return;

            // Facing logic: face the river center even when on a slot
            const d = slot.x < sample.centerPos.x ? -1 : 1;
            const riverAngle = Math.atan2(sample.tangent.x, sample.tangent.z);
            let rotation = (d > 0) ? Math.PI / 2 : -Math.PI / 2;
            rotation += riverAngle;

            const animal = AnimalSpawner.createEntity(animalClass, context,
                slot.x, slot.z, rotation,
                slot.y, new THREE.Vector3(0, 1, 0),
                this.options);

            if (animal) {
                slot.isOccupied = true;
                animal.currentSlot = slot;
            }
        } else {
            super.spawn(context, sample);
        }
    }
}

class Details {
    protected static defaultPredicate =
        LayoutRules.all([
            LayoutRules.min_bank_distance(1.0),
            LayoutRules.select({
                land: LayoutRules.slope_in_range(0, 20),
                water: LayoutRules.true()
            }),
            LayoutRules.is_free()
        ]);

    protected static landPredicate =
        LayoutRules.all([
            LayoutRules.min_bank_distance(1.0),
            LayoutRules.select({
                land: LayoutRules.slope_in_range(0, 20),
            }),
            LayoutRules.is_free()
        ]);

    protected static waterPredicate =
        LayoutRules.all([
            LayoutRules.min_bank_distance(1.0),
            LayoutRules.select({
                water: LayoutRules.true()
            }),
            LayoutRules.is_free()
        ]);

    protected static aggressiveness(ctx: LayoutParams): number {
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

/**
 * Helper class for animal rules. Provides a get() function to create a
 * layout rule.
 */
abstract class AnimalRule extends Details {
    private factory: AnimalClass;
    private decorationIds: DecorationId[];
    private radius: number;
    private heightInWater: number;

    constructor(
        factory: AnimalClass, decorationIds: DecorationId[],
        radius: number, heightInWater: number
    ) {
        super();
        this.factory = factory;
        this.decorationIds = decorationIds;
        this.radius = radius;
        this.heightInWater = heightInWater;
    }

    protected abstract behavior(ctx: LayoutParams): AnimalBehaviorConfig;

    public get(predicate: PlacementPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            if (predicate !== undefined && !predicate(ctx, this.radius)) return null;
            return this.createPlacement(ctx);
        }
    }

    protected createPlacement(ctx: LayoutParams): AnimalPlacement {
        return new AnimalPlacement({
            index: ctx.index,
            x: ctx.x,
            y: 0,
            z: ctx.z,
            radius: this.radius,
            habitat: ctx.habitat,
            factory: this.factory,
            heightInWater: this.heightInWater,
            options: {
                aggressiveness: Details.aggressiveness(ctx),
                biomeZRange: ctx.world.biomeZRange,
                behavior: this.behavior(ctx)
            },
            decorationIds: this.decorationIds
        });
    }
}

/**
 * Helper class for animal rules when an animal wants to require placement
 * of a 'species' that will have a slot for attaching the animal. Provides
 * a get() function to create a layout rule.
 */
abstract class AnimalSlotRule extends Details {
    private factory: AnimalClass;
    private decorationIds: DecorationId[];
    private radius: number;
    private heightInWater: number;

    constructor(
        factory: AnimalClass, decorationIds: DecorationId[],
        radius: number, heightInWater: number
    ) {
        super();
        this.factory = factory;
        this.decorationIds = decorationIds;
        this.radius = radius;
        this.heightInWater = heightInWater;
    }

    protected abstract behavior(ctx: LayoutParams): AnimalBehaviorConfig;

    public get(slot: { name: string, radius: number },
        predicate: PlacementPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            if (predicate !== undefined && !predicate(ctx, this.radius)) return null;
            return this.createPlacement(ctx, slot.name, slot.radius * 1.5);
        }
    }

    protected createPlacement(
        ctx: LayoutParams,
        slot: string,
        searchRadius: number,
    ): AnimalPlacement {
        return new AnimalSlotPlacement({
            index: ctx.index,
            x: ctx.x,
            y: 0,
            z: ctx.z,
            radius: this.radius,
            habitat: ctx.habitat,
            factory: this.factory,
            heightInWater: this.heightInWater,
            options: {
                aggressiveness: Details.aggressiveness(ctx),
                biomeZRange: ctx.world.biomeZRange,
                behavior: this.behavior(ctx)
            },
            slotType: slot,
            searchRadius: searchRadius,
            decorationIds: this.decorationIds
        });
    }
}

export class AlligatorRule extends AnimalRule {
    private static _instance: AlligatorRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new AlligatorRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Alligator, ['alligator'],
            EntityMetadata.alligator.radius,
            Alligator.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat);
    }
}

export class HippoRule extends AnimalRule {
    private static _instance: HippoRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new HippoRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Hippo, ['hippo'],
            EntityMetadata.hippo.radius,
            Hippo.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat);
    }
}

export class SwanRule extends AnimalRule {
    private static _instance: SwanRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new SwanRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Swan, ['swan'],
            EntityMetadata.swan.radius,
            Swan.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class UnicornRule extends AnimalRule {
    private static _instance: UnicornRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.landPredicate): LayoutRule {
        if (!this._instance) this._instance = new UnicornRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Unicorn, ['unicorn'],
            EntityMetadata.unicorn.radius,
            0
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'unicorn' };
    }
}

export class BluebirdRule extends AnimalRule {
    private static _instance: BluebirdRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.landPredicate): LayoutRule {
        if (!this._instance) this._instance = new BluebirdRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Bluebird, ['bluebird'],
            EntityMetadata.bluebird.radius,
            0
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'shore-landing', noticeDistance: 100.0, flightSpeed: 25.0 };
    }
}

export class ParrotRule extends AnimalSlotRule {
    private static _instance: ParrotRule = null;

    public static get(
        slot: { name: string, radius: number },
        predicate: PlacementPredicate = AnimalRule.landPredicate
    ): LayoutRule {
        if (!this._instance) this._instance = new ParrotRule;
        return this._instance.get(slot, predicate);
    }

    constructor() {
        super(
            Parrot, ['parrot'],
            EntityMetadata.parrot.radius,
            0
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'slot-landing', slotTypes: ['beach-chair'], noticeDistance: 100.0, flightSpeed: 25.0 };
    }
}

export class BrownBearRule extends AnimalRule {
    private static _instance: BrownBearRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new BrownBearRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            BrownBear, ['brownBear'],
            EntityMetadata.brownBear.radius,
            BrownBear.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class PolarBearRule extends AnimalRule {
    private static _instance: PolarBearRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new PolarBearRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            PolarBear, ['polarBear'],
            EntityMetadata.polarBear.radius,
            PolarBear.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class MooseRule extends AnimalRule {
    private static _instance: MooseRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new MooseRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Moose, ['moose'],
            EntityMetadata.moose.radius,
            Moose.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class DucklingRule extends AnimalRule {
    private static _instance: DucklingRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new DucklingRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Duckling, ['duckling'],
            EntityMetadata.duckling.radius,
            Duckling.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class PenguinKayakRule extends AnimalRule {
    private static _instance: PenguinKayakRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new PenguinKayakRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            PenguinKayak, ['penguinKayak'],
            EntityMetadata.penguinKayak.radius,
            PenguinKayak.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class DragonflyRule extends AnimalRule {
    private static _instance: DragonflyRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new DragonflyRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Dragonfly, ['dragonfly'],
            EntityMetadata.dragonfly.radius,
            0
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return {
            type: 'wandering',
            noticeDistance: 60.0,
            flightSpeed: 40.0,
            flightHeight: 4.0,
            buzzDuration: 2.0,
            buzzHeight: 1.5,
            buzzOffset: 3.0,
            wanderRadius: 10.0
        };
    }
}

export class TRexRule extends AnimalRule {
    private static _instance: TRexRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new TRexRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            TRex, ['trex'],
            EntityMetadata.trex.radius,
            TRex.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class TriceratopsRule extends AnimalRule {
    private static _instance: TriceratopsRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new TriceratopsRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Triceratops, ['triceratops'],
            EntityMetadata.triceratops.radius,
            Triceratops.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class BrontosaurusRule extends AnimalRule {
    private static _instance: BrontosaurusRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new BrontosaurusRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Brontosaurus, ['brontosaurus'],
            EntityMetadata.brontosaurus.radius,
            Brontosaurus.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_wait_attack(ctx.habitat, 'WolfAttack');
    }
}

export class PterodactylRule extends AnimalRule {
    private static _instance: PterodactylRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new PterodactylRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Pterodactyl, ['pterodactyl'],
            EntityMetadata.pterodactyl.radius,
            0
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'shore-landing', noticeDistance: 200.0, flightSpeed: 30.0 };
    }
}

export class SnakeRule extends AnimalRule {
    private static _instance: SnakeRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new SnakeRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Snake, ['snake'],
            EntityMetadata.snake.radius,
            Snake.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'attack', logicName: 'WolfAttack' };
    }
}

export class EgretRule extends AnimalRule {
    private static _instance: EgretRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new EgretRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Egret, ['egret'],
            EntityMetadata.egret.radius,
            Egret.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'water-landing', noticeDistance: 20.0, flightSpeed: 25.0, landingHeight: Egret.HEIGHT_IN_WATER };
    }
}

export class DolphinRule extends AnimalRule {
    private static _instance: DolphinRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new DolphinRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Dolphin, ['dolphin'],
            EntityMetadata.dolphin.radius,
            Dolphin.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class NarwhalRule extends AnimalRule {
    private static _instance: NarwhalRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.waterPredicate): LayoutRule {
        if (!this._instance) this._instance = new NarwhalRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Narwhal, ['narwhal'],
            EntityMetadata.narwhal.radius,
            Narwhal.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'swim' };
    }
}

export class TurtleRule extends AnimalRule {
    private static _instance: TurtleRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new TurtleRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Turtle, ['turtle'],
            EntityMetadata.turtle.radius,
            Turtle.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return ctx.habitat === 'land' ? { type: 'wait-swim' } : { type: 'swim' };
    }
}

export class ButterflyRule extends AnimalRule {
    private static _instance: ButterflyRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.landPredicate): LayoutRule {
        if (!this._instance) this._instance = new ButterflyRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Butterfly, ['butterfly'],
            EntityMetadata.butterfly.radius,
            0
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'shore-landing', noticeDistance: 100.0, flightSpeed: 20.0 };
    }
}

export class GingerManRule extends AnimalRule {
    private static _instance: GingerManRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new GingerManRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            GingerMan, ['gingerman'],
            EntityMetadata.gingerman.radius,
            GingerMan.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return { type: 'walk-swim' };
    }
}

export class MonkeyRule extends AnimalRule {
    private static _instance: MonkeyRule = null;

    public static get(predicate: PlacementPredicate = AnimalRule.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new MonkeyRule;
        return this._instance.get(predicate);
    }

    constructor() {
        super(
            Monkey, ['monkey'],
            EntityMetadata.monkey.radius,
            Monkey.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutParams): AnimalBehaviorConfig {
        return this.behavior_walk_attack(ctx.habitat);
    }
}
