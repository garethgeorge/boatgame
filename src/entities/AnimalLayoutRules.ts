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
import { Decorations, DecorationId } from '../world/decorations/Decorations';
import { PlacementPredicate, LayoutRules } from '../world/layout/LayoutRuleBuilders';
import { DecorationRequirement, LayoutPlacement } from '../world/layout/LayoutPlacement';
import { LayoutContext, LayoutRule, Habitat } from '../world/layout/LayoutRule';

interface AnimalPlacementParams {
    index: number;
    x: number;
    y: number;
    z: number;
    groundRadius: number;
    requirement?: DecorationRequirement;

    id: EntityIds;
    habitat: Habitat;
    factory: AnimalClass;
    heightInWater: number;
    options: AnimalSpawnOptions;
    decorationIds?: DecorationId[];
}

export class AnimalPlacement extends LayoutPlacement {
    public readonly id: EntityIds;
    public readonly habitat: Habitat;
    public readonly factory: AnimalClass;
    public readonly heightInWater: number;
    public readonly options: AnimalSpawnOptions;
    public readonly decorationIds: DecorationId[];

    constructor(params: AnimalPlacementParams) {
        super(params.index, params.x, params.y, params.z,
            params.groundRadius, 0, params.requirement);
        this.id = params.id;
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

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        if (this.decorationIds && this.decorationIds.length > 0) {
            yield* Decorations.ensureAllLoaded(this.decorationIds as any);
        }
    }
}

export interface AnimalSlotPlacementParams extends AnimalPlacementParams {
    requirement: DecorationRequirement;
    slotType: string;
}

/**
 * Specialized animal placement that attempts to find an attachment slot (e.g., a chair)
 * before falling back to standard placement.
 */
export class AnimalSlotPlacement extends AnimalPlacement {
    public readonly slotType: string;

    constructor(params: AnimalSlotPlacementParams) {
        super(params);
        this.slotType = params.slotType;
    }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        const slot = context.chunk.slots.findNearbySlot(this.slotType, this.x, this.z, 10.0);
        if (slot) {
            console.log('[Populate] Found slot');
            const animalClass = this.factory;
            if (!animalClass) return;

            // Facing logic: face the river center even when on a slot
            const d = slot.x < sample.centerPos.x ? -1 : 1;
            const riverAngle = Math.atan2(sample.tangent.x, sample.tangent.z);
            let rotation = (d > 0) ? Math.PI / 2 : -Math.PI / 2;
            rotation += riverAngle;

            AnimalSpawner.createEntity(animalClass, context,
                slot.x, slot.z, rotation,
                slot.y, new THREE.Vector3(0, 1, 0),
                this.options);
        } else {
            console.log('[Populate] No slot');
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
            })
        ]);

    protected static landPredicate =
        LayoutRules.all([
            LayoutRules.min_bank_distance(1.0),
            LayoutRules.select({
                land: LayoutRules.slope_in_range(0, 20),
            })
        ]);

    protected static waterPredicate =
        LayoutRules.all([
            LayoutRules.min_bank_distance(1.0),
            LayoutRules.select({
                water: LayoutRules.true()
            })
        ]);

    protected static aggressiveness(ctx: LayoutContext): number {
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
    private id: EntityIds;
    private factory: AnimalClass;
    private decorationIds: DecorationId[];
    private radius: number;
    private heightInWater: number;

    constructor(
        id: EntityIds, factory: AnimalClass, decorationIds: DecorationId[],
        radius: number, heightInWater: number
    ) {
        super();
        this.id = id;
        this.factory = factory;
        this.decorationIds = decorationIds;
        this.radius = radius;
        this.heightInWater = heightInWater;
    }

    protected abstract behavior(ctx: LayoutContext): AnimalBehaviorConfig;

    public get(predicate: PlacementPredicate): LayoutRule {
        return (ctx: LayoutContext): AnimalPlacement | null => {
            const groundRadius = this.radius;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return this.createPlacement(ctx, groundRadius);
        }
    }

    protected createPlacement(ctx: LayoutContext, groundRadius: number): AnimalPlacement {
        return new AnimalPlacement({
            index: ctx.index,
            x: ctx.x,
            y: 0,
            z: ctx.z,
            groundRadius,
            id: this.id,
            habitat: ctx.habitat,
            factory: this.factory,
            heightInWater: this.heightInWater,
            options: {
                aggressiveness: Details.aggressiveness(ctx),
                biomeZRange: ctx.biomeZRange,
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
    private id: EntityIds;
    private factory: AnimalClass;
    private decorationIds: DecorationId[];
    private radius: number;
    private heightInWater: number;

    constructor(
        id: EntityIds, factory: AnimalClass, decorationIds: DecorationId[],
        radius: number, heightInWater: number
    ) {
        super();
        this.id = id;
        this.factory = factory;
        this.decorationIds = decorationIds;
        this.radius = radius;
        this.heightInWater = heightInWater;
    }

    protected abstract behavior(ctx: LayoutContext): AnimalBehaviorConfig;

    /** 
     * Get layout rule for the animal. species identifies a decoration
     * that is required to be created and slot is a slot on that decoration
     * where the animal will be attached.
     */
    public get(species: string, slot: string, predicate: PlacementPredicate): LayoutRule {
        return (ctx: LayoutContext): AnimalPlacement | null => {
            const groundRadius = this.radius;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return this.createPlacement(ctx, species, slot, groundRadius);
        }
    }

    protected createPlacement(
        ctx: LayoutContext,
        species: string, slot: string,
        groundRadius: number
    ): AnimalPlacement {
        return new AnimalSlotPlacement({
            index: ctx.index,
            x: ctx.x,
            y: 0,
            z: ctx.z,
            groundRadius,
            id: this.id,
            habitat: ctx.habitat,
            factory: this.factory,
            heightInWater: this.heightInWater,
            options: {
                aggressiveness: Details.aggressiveness(ctx),
                biomeZRange: ctx.biomeZRange,
                behavior: this.behavior(ctx)
            },
            requirement: {
                species: species,
                x: ctx.x, y: 0, z: ctx.z,
                groundRadius, canopyRadius: 0
            },
            slotType: slot,
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
            EntityIds.ALLIGATOR, Alligator, ['alligator'],
            EntityMetadata.alligator.radius,
            Alligator.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.HIPPO, Hippo, ['hippo'],
            EntityMetadata.hippo.radius,
            Hippo.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.SWAN, Swan, ['swan'],
            EntityMetadata.swan.radius,
            Swan.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.UNICORN, Unicorn, ['unicorn'],
            EntityMetadata.unicorn.radius,
            0
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.BLUEBIRD, Bluebird, ['bluebird'],
            EntityMetadata.bluebird.radius,
            0
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
    }
}

export class ParrotRule extends AnimalSlotRule {
    private static _instance: ParrotRule = null;

    public static get(
        species: string, slot: string,
        predicate: PlacementPredicate = AnimalRule.landPredicate
    ): LayoutRule {
        if (!this._instance) this._instance = new ParrotRule;
        return this._instance.get(species, slot, predicate);
    }

    constructor() {
        super(
            EntityIds.PARROT, Parrot, ['parrot'],
            EntityMetadata.parrot.radius,
            0
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
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
            EntityIds.BROWN_BEAR, BrownBear, ['brownBear'],
            EntityMetadata.brownBear.radius,
            BrownBear.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.POLAR_BEAR, PolarBear, ['polarBear'],
            EntityMetadata.polarBear.radius,
            PolarBear.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.MOOSE, Moose, ['moose'],
            EntityMetadata.moose.radius,
            Moose.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.DUCKLING, Duckling, ['duckling'],
            EntityMetadata.duckling.radius,
            Duckling.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.PENGUIN_KAYAK, PenguinKayak, ['penguinKayak'],
            EntityMetadata.penguinKayak.radius,
            PenguinKayak.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.DRAGONFLY, Dragonfly, ['dragonfly'],
            EntityMetadata.dragonfly.radius,
            0
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
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
            EntityIds.TREX, TRex, ['trex'],
            EntityMetadata.trex.radius,
            TRex.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.TRICERATOPS, Triceratops, ['triceratops'],
            EntityMetadata.triceratops.radius,
            Triceratops.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.BRONTOSAURUS, Brontosaurus, ['brontosaurus'],
            EntityMetadata.brontosaurus.radius,
            Brontosaurus.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.PTERODACTYL, Pterodactyl, ['pterodactyl'],
            EntityMetadata.pterodactyl.radius,
            0
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
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
            EntityIds.SNAKE, Snake, ['snake'],
            EntityMetadata.snake.radius,
            Snake.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.EGRET, Egret, ['egret'],
            EntityMetadata.egret.radius,
            Egret.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
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
            EntityIds.DOLPHIN, Dolphin, ['dolphin'],
            EntityMetadata.dolphin.radius,
            Dolphin.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.TURTLE, Turtle, ['turtle'],
            EntityMetadata.turtle.radius,
            Turtle.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.BUTTERFLY, Butterfly, ['butterfly'],
            EntityMetadata.butterfly.radius,
            0
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
        return { type: 'none' }; // ignored
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
            EntityIds.GINGERMAN, GingerMan, ['gingerman'],
            EntityMetadata.gingerman.radius,
            GingerMan.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
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
            EntityIds.MONKEY, Monkey, ['monkey'],
            EntityMetadata.monkey.radius,
            Monkey.HEIGHT_IN_WATER
        );
    }

    protected behavior(ctx: LayoutContext): AnimalBehaviorConfig {
        return this.behavior_walk_attack(ctx.habitat);
    }
}
