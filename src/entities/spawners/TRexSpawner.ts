import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { TRex } from '../../entities/obstacles/TRex';
import { RiverSystem } from '../../world/RiverSystem';

export class TRexSpawner implements Spawnable {
    id = 'trex';

    getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
        const chunkLength = zEnd - zStart;
        const density = 0.1 / 15;
        const count = chunkLength * density;
        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            // 60% chance to spawn on shore
            const isShore = Math.random() < 0.6;

            if (isShore) {
                // Shore Spawning Logic
                const placement = context.placementHelper.findShorePlacement(
                    zStart,
                    zEnd,
                    riverSystem,
                    3.0,
                    3.0
                );

                if (placement) {
                    const entity = new TRex(context.physicsEngine, {
                        x: placement.worldX,
                        y: placement.worldZ,
                        angle: placement.rotation,
                        height: placement.height,
                        terrainNormal: placement.normal,
                        onShore: true,
                        stayOnShore: Math.random() > 0.5
                    });
                    context.entityManager.add(entity, context.chunkIndex);
                }
            } else {
                // Find a center for the cluster
                const centerPos = context.placementHelper.tryPlace(zStart, zEnd, 5.0, {
                    minDistFromBank: 3.0
                });

                if (centerPos) {
                    const angle = Math.random() * Math.PI * 2;
                    const entity = new TRex(context.physicsEngine, {
                        x: centerPos.x,
                        y: centerPos.z,
                        height: TRex.HEIGHT_IN_WATER,
                        angle
                    });
                    context.entityManager.add(entity, context.chunkIndex);
                }
            }
        }
    }
}
