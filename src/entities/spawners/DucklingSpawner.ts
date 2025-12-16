import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Duckling } from '../../entities/obstacles/Duckling';

export class DucklingSpawner implements Spawnable {
    id = 'duckling';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only in Forest biome
        if (biomeType !== 'forest') return 0;

        const baseDensity = 0.01;
        const count = chunkLength * baseDensity;

        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        for (let i = 0; i < count; i++) {
            const radius = 1.5; // Approximate size for placement

            // Random placement across width
            const pos = context.placementHelper.tryPlace(context.zStart, context.zEnd, radius, {
                minDistFromBank: 1.0
            });

            if (pos) {
                const angle = Math.random() * Math.PI * 2;
                const entity = new Duckling(pos.x, pos.z, context.physicsEngine, angle);
                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
