import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Alligator } from '../../entities/obstacles/Alligator';
import { RiverSystem } from '../../world/RiverSystem';

export class AlligatorSpawner implements Spawnable {
    id = 'croc';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in desert biome
        if (biomeType !== 'desert') return 0;

        // Start at 1000m
        const dist = Math.abs(context.zStart);
        if (dist < 1000) return 0;

        // Ramp: 0% -> 8% (0.08 per 15m)
        // 0.08 per 15m = 0.0053 per meter
        // We split the density between crocs and hippos, so use half: 0.00265
        // Ramp factor: (difficulty - 0.13) / (1 - 0.13)
        const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
        const baseDensity = 0.00265 * ramp;

        const count = chunkLength * baseDensity;

        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            // 30% chance to spawn on shore
            const isShore = Math.random() < 0.3;

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
                    const entity = new Alligator(context.physicsEngine, {
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
                // Water Spawning Logic (Cluster)
                const clusterSize = Math.random() > 0.5 ? 2 : 1;

                // Find a center for the cluster
                const centerPos = context.placementHelper.tryPlace(context.zStart, context.zEnd, 5.0, {
                    minDistFromBank: 3.0
                });

                if (centerPos) {
                    for (let j = 0; j < clusterSize; j++) {
                        const offsetX = (Math.random() - 0.5) * 5;
                        const offsetZ = (Math.random() - 0.5) * 5;

                        const x = centerPos.x + offsetX;
                        const z = centerPos.z + offsetZ;

                        const angle = Math.random() * Math.PI * 2;
                        const entity = new Alligator(context.physicsEngine, {
                            x,
                            y: z,
                            angle
                        });
                        context.entityManager.add(entity, context.chunkIndex);
                    }
                }
            }
        }
    }
}
