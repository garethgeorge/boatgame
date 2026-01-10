import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Dolphin } from '../../entities/obstacles/Dolphin';
import { RiverGeometrySample } from '../../world/RiverGeometry';

export class DolphinSpawner extends BaseSpawner {
    id = 'dolphin';

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.01;
    }

    async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const radius = 2.0;

            const pos = context.placementHelper.tryPlace(zStart, zEnd, radius, {
                minDistFromBank: 2.0
            });

            if (pos) {
                const angle = Math.random() * Math.PI * 2;
                const entity = new Dolphin(pos.x, pos.z, context.physicsEngine, angle);
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
        const radius = 2.0;
        const minSpacing = 4.0;
        const minDistFromBank = 2.0;

        const pos = context.placementHelper.tryRiverPlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minDistFromBank,
            distanceRange
        );

        if (pos) {
            const angle = Math.random() * Math.PI * 2;
            const entity = new Dolphin(pos.worldX, pos.worldZ, context.physicsEngine, angle);
            context.entityManager.add(entity);
            return true;
        }
        return false;
    }

    async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
        return false;
    }
}
