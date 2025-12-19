import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Hippo } from '../../entities/obstacles/Hippo';

export class HippoSpawner implements Spawnable {
    id = 'hippo';

    getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
        const chunkLength = zEnd - zStart;
        // Start at 1000m
        const dist = Math.abs(zStart);
        if (dist < 1000) return 0;

        const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
        const baseDensity = 0.00265 * ramp;

        const count = chunkLength * baseDensity;
        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            // Cluster logic: 1 or 2
            const clusterSize = Math.random() > 0.5 ? 2 : 1;

            // Find a center for the cluster
            const centerPos = context.placementHelper.tryPlace(zStart, zEnd, 5.0, {
                minDistFromBank: 3.0
            });

            if (centerPos) {
                for (let j = 0; j < clusterSize; j++) {
                    const offsetX = (Math.random() - 0.5) * 5;
                    const offsetZ = (Math.random() - 0.5) * 5;

                    const x = centerPos.x + offsetX;
                    const z = centerPos.z + offsetZ;

                    const angle = Math.random() * Math.PI * 2;
                    const entity = new Hippo(x, z, context.physicsEngine, angle);
                    context.entityManager.add(entity, context.chunkIndex);
                }
            }
        }
    }
}

