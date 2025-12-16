import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../../managers/Spawnable';
import { BrownBear } from '../obstacles/BrownBear';
import { RiverSystem } from '../../world/RiverSystem';
import { PlacementHelper } from '../../managers/PlacementHelper';

export class BrownBearSpawner implements Spawnable {
    id = 'brownbear';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in forest biome
        if (biomeType !== 'forest') return 0;

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
                // Create the brown bear entity with terrain-based positioning
                const entity = new BrownBear(
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
