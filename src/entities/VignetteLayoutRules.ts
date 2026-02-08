import * as THREE from 'three';
import { EntityIds } from "./EntityIds";
import { RiverGeometrySample } from "../world/RiverGeometry";
import { PopulationContext } from "../world/biomes/PopulationContext";
import { RiverSystem } from "../world/RiverSystem";
import { Decorations, DecorationId } from '../world/decorations/Decorations';
import { LayoutRules, PlacementPredicate } from '../world/layout/LayoutRuleBuilders';
import { Parrot } from './obstacles/Parrot';
import { DecorationMetadata } from '../world/decorations/DecorationMetadata';
import { AnimalSpawner } from './spawners/AnimalSpawner';
import { LayoutPlacement } from '../world/layout/LayoutPlacement';
import { LayoutContext, LayoutRule } from '../world/layout/LayoutRule';

/**
 * Metadata for vignette placements.
 */
export class BirdOnBeachChairPlacement extends LayoutPlacement {
    constructor(
        index: number, x: number, y: number, z: number, groundRadius: number,
        public readonly scale: number, // for chair
        public readonly biomeZRange: [number, number],
        public readonly decorationIds: DecorationId[] = []
    ) {
        super(index, x, y, z, groundRadius);
    }

    public get id() { return EntityIds.PARROT; }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        const { x, z } = this;

        const riverSystem = RiverSystem.getInstance();
        const height = riverSystem.terrainGeometry.calculateHeight(x, z);
        const chairScale = 3.0; // Standard chair scale from PropParams

        // Calculate rotation (facing the river)
        const d = x < sample.centerPos.x ? -1 : 1;
        const riverAngle = Math.atan2(sample.tangent.x, sample.tangent.z);
        // d < 0 is left bank, should face right (PI/2)
        // d > 0 is right bank, should face left (-PI/2)
        let rotation = (d > 0) ? Math.PI / 2 : -Math.PI / 2;
        rotation += riverAngle;

        // 1. Place the static prop (Beach Chair)
        // We use the decoHelper to bake it into the static geometry
        const chairModel = Decorations.getBeachChair()?.model;
        if (chairModel) {
            context.decoHelper.positionAndCollectGeometry(
                context,
                chairModel,
                x, height, z,
                chairScale,
                rotation + Math.PI  // model needs rotating
            );
        }

        // 2. Spawn the dynamic entity (Parrot)
        // Offset the parrot to sit on the backrest.
        const chairHeight = DecorationMetadata.beachChair.height * chairScale;
        const backrestOffset = DecorationMetadata.beachChair.backOffset * chairScale;

        // Rotation points toward river center. 
        // We need the parrot to be at (x, z) + rotated(0, 0, backrestOffset)
        const parrotX = x + Math.sin(rotation) * backrestOffset;
        const parrotZ = z + Math.cos(rotation) * backrestOffset;
        const parrotHeight = height + chairHeight;

        // Parrot should face the same way or slightly offset? 
        // Let's have it face the same way as the chair for now (towards the river).
        AnimalSpawner.createEntity(Parrot, context,
            parrotX, parrotZ, rotation,
            parrotHeight, new THREE.Vector3(0, 1, 0),
            {
                aggressiveness: 0.5,
                biomeZRange: this.biomeZRange,
                behavior: { type: 'none' }
            });
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* Decorations.ensureAllLoaded(this.decorationIds as any);
    }
}

export class BirdOnBeachChairRule {
    private static _instance: BirdOnBeachChairRule = null;

    private static defaultPredicate =
        LayoutRules.all([
            LayoutRules.min_bank_distance(1.0),
            LayoutRules.select({
                land: LayoutRules.slope_in_range(0, 10),
            })
        ]);

    public static get(predicate: PlacementPredicate = this.defaultPredicate): LayoutRule {
        if (!this._instance) this._instance = new BirdOnBeachChairRule();
        return (ctx: LayoutContext) =>
            this._instance.generate(ctx, predicate);
    }

    public generate(ctx: LayoutContext, predicate: PlacementPredicate): BirdOnBeachChairPlacement | null {
        // Chair scale
        const scale = 3.0;
        const groundRadius = DecorationMetadata.beachChair.groundRadius * scale;

        if (predicate !== undefined && !predicate(ctx, groundRadius)) return null;

        return new BirdOnBeachChairPlacement(
            ctx.index,
            ctx.x,
            0,
            ctx.z,
            groundRadius,
            scale,
            ctx.biomeZRange,
            ['beachChair', 'parrot']
        );
    }
}

