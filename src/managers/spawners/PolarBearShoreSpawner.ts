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

        const probability = 0.1 / chunkLength; // roughly 0.1 bears per 15m chunk

        return Math.random() * probability
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
                    placement.normal
                );

                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
