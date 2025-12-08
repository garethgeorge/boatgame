import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { PolarBear } from '../../entities/obstacles/PolarBear';
import { RiverSystem } from '../../world/RiverSystem';
import { PlacementHelper } from '../PlacementHelper';

export class PolarBearShoreSpawner implements Spawnable {
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
                const entity = new PolarBear(
                    placement.worldX,
                    placement.worldZ,
                    context.physicsEngine,
                    placement.rotation,
                    placement.height,
                    placement.normal,
                    true, // onShore
                    Math.random() > 0.5 // 50% chance to stay on shore
                );

                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
