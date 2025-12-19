import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Moose } from '../../entities/obstacles/Moose';
import { RiverSystem } from '../../world/RiverSystem';

export class MooseSpawner implements Spawnable {
    id = 'moose';

    getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
        const chunkLength = zEnd - zStart;
        const density = 0.1 / 15;
        const count = chunkLength * density;
        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            const placement = context.placementHelper.findShorePlacement(
                zStart,
                zEnd,
                riverSystem,
                3.0,
                7.0
            );

            if (placement) {
                // Create the moose entity with terrain-based positioning
                const entity = new Moose(context.physicsEngine, {
                    x: placement.worldX,
                    y: placement.worldZ,
                    angle: placement.rotation,
                    height: placement.height,
                    terrainNormal: placement.normal,
                    onShore: true,
                    stayOnShore: false
                });

                context.entityManager.add(entity, context.chunkIndex);
            }
        }
    }
}
