import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../../managers/Spawnable';
import { Monkey } from '../obstacles/Monkey';
import { RiverSystem } from '../../world/RiverSystem';

export class MonkeySpawner implements Spawnable {
    id = 'monkeyshore';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in desert biome
        if (biomeType !== 'desert') return 0;

        const probability = 0.1 / chunkLength; // roughly same as alligator

        return Math.random() * probability * chunkLength; // wait, AlligatorSpawner had `Math.random() * probability` which is tiny if probability is small. 
        // Let's re-read AlligatorShoreSpawner carefully.
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            const placement = context.placementHelper.findShorePlacement(
                context.zStart,
                context.zEnd,
                riverSystem,
                2.0, // smaller clearance for monkey
                2.0
            );

            if (placement) {
                // Create the monkey entity with terrain-based positioning
                // Pass onShore=true to enable ONSHORE state
                const entity = new Monkey(
                    placement.worldX,
                    placement.worldZ,
                    context.physicsEngine,
                    placement.rotation,
                    placement.height,
                    placement.normal,
                    true,  // onShore = true
                    Math.random() > 0.5 // 50% chance to stay on shore
                );

                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
