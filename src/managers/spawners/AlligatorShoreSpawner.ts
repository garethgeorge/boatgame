import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Alligator } from '../../entities/obstacles/Alligator';
import { RiverSystem } from '../../world/RiverSystem';
import { PlacementHelper } from '../PlacementHelper';

export class AlligatorShoreSpawner implements Spawnable {
    id = 'alligatorshore';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in desert biome
        if (biomeType !== 'desert') return 0;

        const probability = 0.1 / chunkLength; // roughly 0.3 alligators per 15m chunk

        return Math.random() * probability
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            // Try multiple times to find a valid shore placement
            let placed = false;
            const maxAttempts = 20;

            for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
                const placement = context.placementHelper.findShorePlacement(
                    context.zStart,
                    context.zEnd,
                    riverSystem,
                    3.0,
                    3.0
                );

                if (!placement) continue;

                // Create the alligator entity with terrain-based positioning
                // Pass onShore=true to enable ONSHORE state
                const entity = new Alligator(
                    placement.worldX,
                    placement.worldZ,
                    context.physicsEngine,
                    placement.rotation,
                    placement.height,
                    placement.normal,
                    true  // onShore = true
                );

                context.entityManager.add(entity, context.chunkIndex);
                placed = true;
            }
        }
    }
}
