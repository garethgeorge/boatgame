import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { PenguinKayak } from '../../entities/obstacles/PenguinKayak';

export class PenguinKayakSpawner extends BaseSpawner {
    id = 'penguinKayak';

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.01;
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
