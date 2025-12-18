import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Brontosaurus } from '../obstacles/Brontosaurus';
import { RiverSystem } from '../../world/RiverSystem';

export class BrontosaurusSpawner implements Spawnable {
    id = 'brontosaurus';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in jurassic biome
        if (biomeType !== 'jurassic') return 0;

        // Roughly 0.1 dinos per 15m chunk
        const density = 0.1 / 15;
        const count = chunkLength * density;

        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            // 60% chance to spawn on shore
            const isShore = Math.random() < 0.6;

            if (isShore) {
                // Shore Spawning Logic
                const placement = context.placementHelper.findShorePlacement(
                    context.zStart,
                    context.zEnd,
                    riverSystem,
                    3.0,
                    3.0
                );

                if (placement) {
                    const entity = new Brontosaurus(
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
            } else {
                // Find a center for the cluster
                const centerPos = context.placementHelper.tryPlace(context.zStart, context.zEnd, 5.0, {
                    minDistFromBank: 3.0
                });

                if (centerPos) {
                    const angle = Math.random() * Math.PI * 2;
                    const entity = new Brontosaurus(
                        centerPos.x,
                        centerPos.z,
                        context.physicsEngine,
                        angle);
                    context.entityManager.add(entity, context.chunkIndex);
                }
            }
        }
    }
}
