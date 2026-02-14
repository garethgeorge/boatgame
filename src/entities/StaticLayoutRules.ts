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
import { PlacementPredicate, LayoutRules } from '../world/layout/LayoutRuleBuilders';
import { IcebergSpawner } from "./spawners/IcebergSpawner";
import { LayoutPlacement } from "../world/layout/LayoutPlacement";
import { LayoutParams, LayoutPlacements, LayoutRule, LayoutGenerator } from "../world/layout/LayoutRule";

class Details {
    public static readonly waterPredicate = LayoutRules.all([
        LayoutRules.min_bank_distance(0.0),
        LayoutRules.select({ water: LayoutRules.true() }),
        LayoutRules.is_free()
    ]);

    public static readonly shorePredicate = LayoutRules.all([
        LayoutRules.select({ water: LayoutRules.true() }),
        LayoutRules.is_free()
    ]);
}

/**
 * A simple implementation of EntityPlacement for static entities that don't need
 * complex logic or parameters beyond their ID.
 */
export class SimpleEntityPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
        public readonly id: EntityIds,
        private readonly spawnFn: (context: PopulationContext, x: number, z: number, radius: number) => void
    ) {
    }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        this.spawnFn(context, this.x, this.z, this.radius);
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    }
}

////////

export class BottleRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const groundRadius = EntityMetadata.messageInABottle.radius;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new SimpleEntityPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.BOTTLE,
                (context, x, z) => MessageInABottleSpawner.createEntity(context, x, z)
            );
        };
    }
}

////////

export class RiverRockPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
        public readonly biomeType: BiomeType
    ) {
    }

    get id() { return EntityIds.ROCK; }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        let pillars = false;
        if (this.biomeType === 'forest') pillars = Math.random() < 0.1;
        else if (this.biomeType === 'desert') pillars = Math.random() < 0.3;

        RockSpawner.createEntity(
            context, this.x, this.z, this.radius, pillars, this.biomeType
        );
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    }
};

export class RiverRockRule extends Details {
    public static get(biomeType: BiomeType, predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r = ctx.world.random();
            const groundRadius = 1.5 + r * 3.0; // 1.5 to 4.5m
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new RiverRockPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                biomeType
            );
        };
    }
}

////////

export class LogRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r = ctx.world.random();
            const length = 10 + r * 10;
            const groundRadius = length / 2;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new SimpleEntityPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.LOG,
                (context, x, z, radius) => LogSpawner.createEntity(context, x, z, radius * 2)
            );
        };
    }
}

////////

export class BuoyPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
        public readonly offset: number
    ) {
    }

    get id() { return EntityIds.BUOY; }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        BuoySpawner.createEntity(context, sample, [this.offset - this.radius, this.offset + this.radius]);
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    }
};

export class BuoyRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r = ctx.world.random();
            const chainLength = (0.3 + r * 0.2) * ctx.sample.bankDist * 2;
            const groundRadius = chainLength / 2;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new BuoyPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                ctx.offset
            );
        };
    }
}

////////

export class PierPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
        public readonly angle: number,
        public readonly hasDepot: boolean
    ) {
    }

    get id() { return EntityIds.PIER; }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        PierSpawner.createEntity(
            context, this.x, this.z, this.radius * 2, this.angle, this.hasDepot);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* PierSpawner.ensureLoaded();
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }
};

export class PierRule extends Details {
    public static get(forceDepot: boolean = false, predicate: PlacementPredicate = this.shorePredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r1 = ctx.world.random();
            const width = 2 * ctx.sample.bankDist;
            const maxPierLength = Math.min(30, width * 0.6);
            const minDepotPierLength = 13.0;
            const minPierLength = Math.max(forceDepot ? minDepotPierLength : 0, width * 0.2);
            let pierLength = minPierLength + r1 * (maxPierLength - minPierLength);
            const groundRadius = pierLength / 2;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

            const r2 = ctx.world.random();
            const pierLengthActual = groundRadius * 2;
            const hasDepot = forceDepot ? forceDepot : (pierLengthActual > minDepotPierLength && r2 > 0.5);

            const dir = ctx.offset < 0 ? 1 : -1;
            const xDir = dir * ctx.sample.normal.x;
            const zDir = dir * ctx.sample.normal.z;
            const angle = Math.atan2(zDir, xDir);

            const xBank = ctx.sample.centerPos.x - xDir * (ctx.sample.bankDist + 2);
            const zBank = ctx.sample.centerPos.z - zDir * (ctx.sample.bankDist + 2);

            const x = xBank + xDir * groundRadius;
            const z = zBank + zDir * groundRadius;

            return new PierPlacement(
                ctx.index, x, 0, z, groundRadius,
                angle,
                hasDepot
            );
        };
    }
}

////////

export class IcebergPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
    ) {
    }

    get id() { return EntityIds.ICEBERG; }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        IcebergSpawner.createEntity(context, this.x, this.z, this.radius);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* IcebergSpawner.ensureLoaded();
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }
};

export class IcebergRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r1 = ctx.world.random();
            const r2 = ctx.world.random();
            let scale = 4.0 + r1;
            if (r2 < 0.05) scale = 3.0;
            else if (r2 < 0.30) scale = 1.5;

            const r3 = ctx.world.random();
            const groundRadius = 4.0 + r3 * scale;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

            return new IcebergPlacement(ctx.index, ctx.x, 0, ctx.z, groundRadius);
        };
    }
}

////////

export class MangrovePlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
    ) {
    }

    get id() { return EntityIds.MANGROVE; }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        MangroveSpawner.createEntity(context, this.x, this.z, this.radius * 1.5);
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    }
};

export class MangroveRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r1 = ctx.world.random();
            let baseScale = 1.0;
            if (r1 < 0.05) baseScale = 2.0;
            else if (r1 < 0.30) baseScale = 1.3;

            const r2 = ctx.world.random();
            const jitter = 0.8 + r2 * 0.4;
            const finalScale = baseScale * jitter;
            const groundRadius = 15.0 * finalScale;

            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new MangrovePlacement(
                ctx.index, ctx.x, 0, ctx.z,
                groundRadius
            );
        };
    }
}

////////

export class PatchPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
        public readonly id: EntityIds,
        public readonly width: number,
        public readonly length: number,
        private readonly spawner: {
            createEntity: (
                context: PopulationContext,
                x: number, z: number, width: number, length: number,
                tangent: { x: number, z: number }) => void,
            ensureLoaded?: () => Generator<void | Promise<void>, void, unknown>
        }
    ) {
    }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        this.spawner.createEntity(context, this.x, this.z, this.width, this.length, sample.tangent);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        if (this.spawner.ensureLoaded) {
            yield* this.spawner.ensureLoaded();
        }
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }
};

export class LilyPadPatchRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r1 = ctx.world.random();
            const r2 = ctx.world.random();
            const length = 16.0 + r1 * 16.0;
            const width = 16.0 + r2 * 16.0;
            const groundRadius = Math.max(width, length) / 2.0;

            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

            return new PatchPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.LILLY_PAD_PATCH,
                width, length,
                LillyPadPatchSpawner
            );
        };
    }
}

////////

export class WaterGrassRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutParams) => {
            const r1 = ctx.world.random();
            const r2 = ctx.world.random();
            const length = 20.0 + r1 * 30.0;
            const width = 10.0 + r2 * 15.0;
            const groundRadius = Math.max(width, length) / 2.0;

            if (ctx.sample.bankDist - Math.abs(ctx.offset) < width / 2) return null;

            return new PatchPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.WATER_GRASS,
                width, length,
                WaterGrassSpawner
            );
        };
    }
}

