import { Vector3 } from '@babylonjs/core';
import { Spawnable, SpawnContext } from '../Spawnable';
import { RiverSystem } from '../../world/RiverSystem';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions, ShorePlacementOptions } from '../../managers/PlacementHelper';
import { BaseSpawner } from './BaseSpawner';

export interface ClusterPlacementOptions {
    probability: number;
    size: number;
    distance: number;
}

export abstract class AttackAnimalSpawner extends BaseSpawner {

    protected get shoreProbability(): number {
        return 0.0;
    }
    protected get entityRadius(): number {
        return 5.0;
    }
    protected get heightInWater(): number {
        return 0.0;
    }
    protected get clusterPlacement(): ClusterPlacementOptions {
        return { probability: 0.0, size: 2, distance: 5.0 };
    }
    protected get shorePlacement(): ShorePlacementOptions {
        return { minDistFromBank: 3.0, maxDistFromBank: 6.0 };
    }
    protected get waterPlacement(): RiverPlacementOptions {
        return {};
    }

    protected abstract spawnEntity(physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions): Entity;

    async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            // shoreProbability chance to spawn on shore
            const isShore = Math.random() < this.shoreProbability;

            if (isShore) {
                // Shore Spawning Logic
                const placement = context.placementHelper.findShorePlacement(
                    zStart, zEnd, riverSystem, this.shorePlacement
                );

                if (placement) {
                    const entity = this.spawnEntity(context.physicsEngine, {
                        x: placement.worldX,
                        y: placement.worldZ,
                        angle: placement.rotation,
                        height: placement.height,
                        terrainNormal: placement.normal,
                        onShore: true,
                        stayOnShore: Math.random() > 0.5
                    });
                    if (entity)
                        context.entityManager.add(entity, context.chunkIndex);
                }
            } else {
                // Water Spawning Logic (Cluster)
                const cluster = this.clusterPlacement;
                const clusterSize = Math.random() < cluster.probability ? cluster.size : 1;

                // Find a center for the cluster
                const centerPos = context.placementHelper.tryPlace(
                    zStart, zEnd, this.entityRadius, this.waterPlacement);

                if (centerPos) {
                    for (let j = 0; j < clusterSize; j++) {
                        let x = centerPos.x;
                        let z = centerPos.z;

                        if (clusterSize > 1) {
                            x += (Math.random() - 0.5) * cluster.distance;
                            z += (Math.random() - 0.5) * cluster.distance;
                        }

                        const angle = Math.random() * Math.PI * 2;
                        const entity = this.spawnEntity(context.physicsEngine, {
                            x,
                            y: z,
                            height: this.heightInWater,
                            angle
                        });
                        if (entity)
                            context.entityManager.add(entity, context.chunkIndex);
                    }
                }
            }
        }
    }

}
