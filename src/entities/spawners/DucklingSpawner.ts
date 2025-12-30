import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Duckling } from '../../entities/obstacles/Duckling';
import { RiverGeometrySample } from '../../world/RiverGeometry';

export class DucklingSpawner extends BaseSpawner {
    id = 'duckling';

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
                const entity = new Duckling(pos.x, pos.z, context.physicsEngine, angle);
                context.entityManager.add(entity);

            }
        }
    }

    async spawnAnimalAbsolute(
        context: SpawnContext,
        sample: RiverGeometrySample,
        distanceRange: [number, number],
        aggressiveness: number
    ): Promise<boolean> {
        const radius = 1.5;
        const minSpacing = 2.0;
        const minDistFromBank = 1.0;

        const pos = context.placementHelper.tryRiverPlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minDistFromBank,
            distanceRange
        );

        if (pos) {
            const angle = Math.random() * Math.PI * 2;
            const entity = new Duckling(pos.worldX, pos.worldZ, context.physicsEngine, angle);
            context.entityManager.add(entity);
            return true;
        }
        return false;
    }

    async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
        // Not used, using custom spawn() or spawnAnimalAbsolute()
        return false;
    }
}
