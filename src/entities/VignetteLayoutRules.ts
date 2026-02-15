import * as THREE from 'three';
import * as planck from 'planck';
import { LayoutPlacement } from '../world/layout/LayoutPlacement';
import { LayoutGenerator, LayoutPlacements, LayoutRule, LayoutParams } from '../world/layout/LayoutRule';
import { PopulationContext } from '../world/biomes/PopulationContext';
import { RiverGeometrySample } from '../world/RiverGeometry';
import { EntityIds } from './EntityIds';
import { Iceberg } from './obstacles/Iceberg';
import { Walrus } from './obstacles/Walrus';
import { DecorationId, Decorations } from '../world/decorations/Decorations';
import { AnimalBehaviorUtils } from './behaviors/AnimalBehaviorUtils';
import { PolarBear } from './obstacles';
import { IcebergSpawner } from './spawners/IcebergSpawner';

class IcebergAnimalPlacement implements LayoutPlacement, LayoutGenerator {
    constructor(
        public readonly index: number,
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly radius: number,
        public readonly biomeZRange: [number, number],
        public readonly animalType: 'walrus' | 'polarBear'
    ) { }

    public spawn(context: PopulationContext, sample: RiverGeometrySample) {
        const iceberg = new Iceberg(this.x, this.z, this.radius, context.physicsEngine);
        context.entityManager.add(iceberg);

        // Position animal on top of iceberg
        // Iceberg surface is at Y=0.2 (from Iceberg.ts)
        let animal = null;
        if (this.animalType === 'walrus') {
            animal = new Walrus(context.physicsEngine, {
                x: this.x,
                y: this.z,
                height: 0.2,
                angle: Math.random() * Math.PI * 2,
                behavior: { type: 'walk-to-boat-attack' },
                zRange: this.biomeZRange

            });
        } else {
            animal = new PolarBear(context.physicsEngine, {
                x: this.x,
                y: this.z,
                height: 0.2,
                angle: Math.random() * Math.PI * 2,
                behavior: { type: 'walk-to-boat-attack' },
                zRange: this.biomeZRange

            });
        }
        context.entityManager.add(animal);

        // Parenting
        iceberg.addChild(animal);
        animal.setTerrainMap(iceberg.getTerrainMap());
    }

    public generate(placements: LayoutPlacements) {
        placements.place(this);
    }

    public *ensureLoaded(loaded: Set<DecorationId>): Generator<void | Promise<void>, void, unknown> {
        if (!loaded.has(this.animalType)) {
            yield* Decorations.ensureAllLoaded([this.animalType]);
            loaded.add(this.animalType);
        }
    }
}

export class VignetteLayoutRules {
    public static icebergWalrus(): LayoutRule {
        return (ctx: LayoutParams) => {
            const r = ctx.world.random();
            const groundRadius = 12.0 + r * 4.0;

            // Standard check for free space
            if (!ctx.is_free(ctx.x, ctx.z, groundRadius)) return null;

            return new IcebergAnimalPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                ctx.world.biomeZRange, 'walrus'
            );
        };
    }

    public static icebergPolarBear(): LayoutRule {
        return (ctx: LayoutParams) => {
            const r = ctx.world.random();
            const groundRadius = 12.0 + r * 4.0;

            // Standard check for free space
            if (!ctx.is_free(ctx.x, ctx.z, groundRadius)) return null;

            return new IcebergAnimalPlacement(
                ctx.index, ctx.x, 0, ctx.z, groundRadius,
                ctx.world.biomeZRange, 'polarBear'
            );
        };
    }
}
