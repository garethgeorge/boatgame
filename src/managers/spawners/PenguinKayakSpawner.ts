import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { PenguinKayak } from '../../entities/obstacles/PenguinKayak';

export class PenguinKayakSpawner implements Spawnable {
    id = 'penguinKayak';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        return 2;
        // Only in Ice biome
        if (biomeType !== 'ice') return 0;

        // Iceberg is 0.02 per meter.
        // PenguinKayak should be 1/2 of that -> 0.01 per meter.
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
                const entity = new PenguinKayak(pos.x, pos.z, context.physicsEngine, angle);
                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
