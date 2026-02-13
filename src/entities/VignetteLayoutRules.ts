import * as THREE from 'three';
import * as planck from 'planck';
import { LayoutPlacement } from '../world/layout/LayoutPlacement';
import { LayoutGenerator, LayoutPlacements, LayoutRule, LayoutParams } from '../world/layout/LayoutRule';
import { PopulationContext } from '../world/biomes/PopulationContext';
import { RiverGeometrySample } from '../world/RiverGeometry';
import { EntityIds } from './EntityIds';
import { Iceberg } from './obstacles/Iceberg';
import { Walrus } from './obstacles/Walrus';
import { Decorations } from '../world/decorations/Decorations';
import { AnimalBehaviorUtils } from './behaviors/AnimalBehaviorUtils';

class IcebergWalrusPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
        public readonly biomeZRange: [number, number]
    ) { }

    get id() { return EntityIds.ICEBERG; } // Primary ID for collision checks

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        const iceberg = new Iceberg(this.x, this.z, this.radius, false, context.physicsEngine);
        context.entityManager.add(iceberg);

        // Position walrus on top of iceberg
        // Iceberg surface is at Y=0.2 (from Iceberg.ts)
        const walrus = new Walrus(context.physicsEngine, {
            x: this.x,
            y: this.z,
            height: 0.2,
            angle: Math.random() * Math.PI * 2,
            behavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            zRange: this.biomeZRange
        });
        context.entityManager.add(walrus);

        // Parenting
        iceberg.addChild(walrus);
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }

    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        yield* Decorations.ensureAllLoaded(['walrus']);
    }
}

export class VignetteLayoutRules {
    public static icebergWalrus(): LayoutRule {
        return (ctx: LayoutParams) => {
            const r = ctx.world.random();
            const groundRadius = 12.0 + r * 4.0;

            // Standard check for free space
            if (!ctx.is_free(ctx.x, ctx.z, groundRadius)) return null;

            return new IcebergWalrusPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                ctx.world.biomeZRange
            );
        };
    }
}
