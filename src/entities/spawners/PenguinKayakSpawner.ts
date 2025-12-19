import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { PenguinKayak } from '../../entities/obstacles/PenguinKayak';

export class PenguinKayakSpawner implements Spawnable {
    id = 'penguinKayak';

    getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
        const chunkLength = zEnd - zStart;
        const baseDensity = 0.01;
        const count = chunkLength * baseDensity;
        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const radius = 1.5; // Approximate size for placement

            const pos = context.placementHelper.tryPlace(zStart, zEnd, radius, {
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
