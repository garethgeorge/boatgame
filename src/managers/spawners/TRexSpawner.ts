import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { TRex } from '../../entities/obstacles/TRex';

export class TRexSpawner implements Spawnable {
    id = 'trex';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in jurassic biome
        if (biomeType !== 'jurassic') return 0;

        return 2;

        // Start at 1000m
        const dist = Math.abs(context.zStart);
        if (dist < 1000) return 0;

        // Ramp: 0% -> 8%
        const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
        // Slightly rarer than alligators? Or same?
        // Alligator base was 0.00265
        const baseDensity = 0.00265 * ramp;

        const count = chunkLength * baseDensity;

        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        for (let i = 0; i < count; i++) {
            // Cluster logic: 1 (Solitary predators usually)
            const clusterSize = 1;

            // Find a center for the cluster
            const centerPos = context.placementHelper.tryPlace(context.zStart, context.zEnd, 5.0, {
                minDistFromBank: 3.0
            });

            if (centerPos) {
                const angle = Math.random() * Math.PI * 2;
                const entity = new TRex(centerPos.x, centerPos.z, context.physicsEngine, angle);
                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
