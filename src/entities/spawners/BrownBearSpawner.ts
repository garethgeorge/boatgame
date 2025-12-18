import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { BrownBear } from '../../entities/obstacles/BrownBear';
import { RiverSystem } from '../../world/RiverSystem';
import { PlacementHelper } from '../PlacementHelper';

export class BrownBearSpawner implements Spawnable {
    id = 'brownbear';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in forest biome
        if (biomeType !== 'forest') return 0;

        // Roughly 0.1 bears per 15m chunk
        const density = 0.1 / 15;
        const count = chunkLength * density;

        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            const placement = context.placementHelper.findShorePlacement(
                context.zStart,
                context.zEnd,
                riverSystem,
                2.5,
                3.0
            );

            if (placement) {
                // Create the brown bear entity with terrain-based positioning
                const entity = new BrownBear(context.physicsEngine, {
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
        }
    }
}
