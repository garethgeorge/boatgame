import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { PolarBear } from '../../entities/obstacles/PolarBear';
import { RiverSystem } from '../../world/RiverSystem';

export class PolarBearSpawner implements Spawnable {
    id = 'polarbear';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in ice biome
        if (biomeType !== 'ice') return 0;

        // Roughly 0.1 bears per 15m chunk
        const density = 0.1 / 15;
        const count = chunkLength * density;

        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            const placement = context.placementHelper.findShorePlacement(
                context.zStart,
                context.zEnd,
                riverSystem,
                2.5,
                3.0
            );

            if (placement) {
                // Create the polar bear entity with terrain-based positioning
                const entity = new PolarBear(context.physicsEngine, {
                    x: placement.worldX,
                    y: placement.worldZ,
                    angle: placement.rotation,
                    height: placement.height,
                    terrainNormal: placement.normal,
                    onShore: true,
                    stayOnShore: Math.random() > 0.5
                });

                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
