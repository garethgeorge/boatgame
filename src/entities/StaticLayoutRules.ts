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
import { LayoutContext, LayoutRule } from "../world/layout/LayoutRule";

class Details {
    public static readonly waterPredicate = LayoutRules.all([
        LayoutRules.min_bank_distance(0.0),
        LayoutRules.select({ water: LayoutRules.true() })
    ]);

    public static readonly shorePredicate = LayoutRules.all([
        LayoutRules.select({ water: LayoutRules.true() })
    ]);
}

/**
 * A simple implementation of EntityPlacement for static entities that don't need
 * complex logic or parameters beyond their ID.
 */
export class SimpleEntityPlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly id: EntityIds,
        private readonly spawnFn: (context: PopulationContext, x: number, z: number, groundRadius: number) => void
    ) {
        super(index, x, y, z, groundRadius);
    }

    override spawn(context: PopulationContext, sample: RiverGeometrySample) {
        this.spawnFn(context, this.x, this.z, this.groundRadius);
    }
}

////////

export class BottleRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutContext): LayoutPlacement | null => {
            const groundRadius = EntityMetadata.messageInABottle.radius;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new SimpleEntityPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.BOTTLE,
                (context, x, z) => MessageInABottleSpawner.createEntity(context, x, z)
            );
        }
    }
}

////////

export class RiverRockPlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly biomeType: BiomeType
    ) {
        super(index, x, y, z, groundRadius);
    }

    get id() { return EntityIds.ROCK; }

    override spawn(context: PopulationContext, sample: RiverGeometrySample) {
        let pillars = false;
        if (this.biomeType === 'forest') pillars = Math.random() < 0.1;
        else if (this.biomeType === 'desert') pillars = Math.random() < 0.3;

        RockSpawner.createEntity(
            context, this.x, this.z, this.groundRadius, pillars, this.biomeType
        );
    }
};

export class RiverRockRule extends Details {
    public static get(biomeType: BiomeType, predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutContext): RiverRockPlacement | null => {
            const groundRadius = 1.5 + Math.random() * 3.0; // 1.5 to 4.5m
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new RiverRockPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                biomeType
            );
        }
    }
}

////////

export class LogRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutContext): LayoutPlacement | null => {
            const length = 10 + Math.random() * 10;
            const groundRadius = length / 2;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new SimpleEntityPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.LOG,
                (context, x, z, radius) => LogSpawner.createEntity(context, x, z, radius * 2)
            );
        }
    }
}

////////

export class BuoyPlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly offset: number
    ) {
        super(index, x, y, z, groundRadius);
    }

    get id() { return EntityIds.BUOY; }

    override spawn(context: PopulationContext, sample: RiverGeometrySample) {
        BuoySpawner.createEntity(context, sample, [this.offset - this.groundRadius, this.offset + this.groundRadius]);
    }
};

export class BuoyRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutContext): BuoyPlacement | null => {
            // Pick a random length 30-50% width
            const chainLength = (0.3 + Math.random() * 0.2) * ctx.sample.bankDist * 2;
            const groundRadius = chainLength / 2;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;
            return new BuoyPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                ctx.offset
            );
        }
    }
}

////////

export class PierPlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly angle: number,
        public readonly hasDepot: boolean
    ) {
        super(index, x, y, z, groundRadius);
    }

    get id() { return EntityIds.PIER; }

    override spawn(context: PopulationContext, sample: RiverGeometrySample) {
        PierSpawner.createEntity(
            context, this.x, this.z, this.groundRadius * 2, this.angle, this.hasDepot);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* PierSpawner.ensureLoaded();
    }
};

export class PierRule extends Details {
    public static get(forceDepot: boolean = false, predicate: PlacementPredicate = this.shorePredicate): LayoutRule {
        return (ctx: LayoutContext): PierPlacement | null => {

            const width = 2 * ctx.sample.bankDist;
            const maxPierLength = Math.min(30, width * 0.6);

            const minDepotPierLength = 13.0;
            const minPierLength = Math.max(forceDepot ? minDepotPierLength : 0, width * 0.2);

            let pierLength = minPierLength + Math.random() * (maxPierLength - minPierLength);

            const groundRadius = pierLength / 2;
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

            const hasDepot = forceDepot ?
                forceDepot : (pierLength > minDepotPierLength && Math.random() > 0.5);

            // calculate pier direction
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
        }
    }
}

////////

export class IcebergPlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly hasBear: boolean
    ) {
        super(index, x, y, z, groundRadius);
    }

    get id() { return EntityIds.ICEBERG; }

    override spawn(context: PopulationContext, sample: RiverGeometrySample) {
        IcebergSpawner.createEntity(context, this.x, this.z, this.groundRadius, this.hasBear);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* IcebergSpawner.ensureLoaded();
    }
};

export class IcebergRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutContext): IcebergPlacement | null => {

            let scale = 4.0 + Math.random();
            let hasBear = false;
            const r = Math.random();
            if (r < 0.05) {
                scale = 3.0;
                hasBear = Math.random() < 0.5;
            } else if (r < 0.30) {
                scale = 1.5;
            }

            const groundRadius = 4.0 + Math.random() * scale;

            // check predicate
            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

            return new IcebergPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                hasBear
            );
        }
    }
}

////////

export class MangrovePlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly size: number
    ) {
        super(index, x, y, z, groundRadius);
    }

    get id() { return EntityIds.MANGROVE; }

    override spawn(context: PopulationContext, sample: RiverGeometrySample) {
        MangroveSpawner.createEntity(context, this.x, this.z, this.size);
    }
};

export class MangroveRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutContext): MangrovePlacement | null => {

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
            const groundRadius = 15.0 * finalScale;
            const size = groundRadius * 1.5;

            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

            return new MangrovePlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                size
            );
        }
    }
}

////////

export class PatchPlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly id: EntityIds,
        public readonly width: number,
        public readonly length: number,
        private readonly spawner: { createEntity: (context: PopulationContext, x: number, z: number, width: number, length: number, tangent: { x: number, z: number }) => void, ensureLoaded?: () => Generator<void | Promise<void>, void, unknown> }
    ) {

        super(index, x, y, z, groundRadius);
    }

    override spawn(context: PopulationContext, sample: RiverGeometrySample) {
        this.spawner.createEntity(context, this.x, this.z, this.width, this.length, sample.tangent);
    }

    override *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        if (this.spawner.ensureLoaded) {
            yield* this.spawner.ensureLoaded();
        }
    }
};

export class LilyPadPatchRule extends Details {
    public static get(predicate: PlacementPredicate = this.waterPredicate): LayoutRule {
        return (ctx: LayoutContext): PatchPlacement | null => {
            const length = 16.0 + Math.random() * 16.0;
            const width = 16.0 + Math.random() * 16.0;

            const groundRadius = Math.max(width, length) / 2.0;

            if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

            return new PatchPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.LILLY_PAD_PATCH,
                width, length,
                LillyPadPatchSpawner
            );
        }
    }
}

////////

export class WaterGrassRule extends Details {
    public static get(): LayoutRule {
        return (ctx: LayoutContext): PatchPlacement | null => {
            const length = 20.0 + Math.random() * 30.0;
            const width = 10.0 + Math.random() * 15.0;

            // Radius for collision check (approximate as max dimension / 2)
            const groundRadius = Math.max(width, length) / 2.0;

            // Not using a predicate because water grass isn't
            // round and collision is ok
            if (ctx.sample.bankDist - Math.abs(ctx.offset) < width / 2)
                return null;

            return new PatchPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                EntityIds.WATER_GRASS,
                width, length,
                WaterGrassSpawner
            );
        }
    }
}

