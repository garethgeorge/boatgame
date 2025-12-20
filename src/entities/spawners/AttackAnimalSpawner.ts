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

    async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
        const riverSystem = RiverSystem.getInstance();
        const isShore = Math.random() < this.shoreProbability;

        if (isShore) {
            const placement = context.placementHelper.findShorePlacement(
                z, z, riverSystem, this.shorePlacement
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
                if (entity) {
                    context.entityManager.add(entity, context.chunkIndex);
                    return true;
                }
            }
        } else {
            const cluster = this.clusterPlacement;
            const clusterSize = Math.random() < cluster.probability ? cluster.size : 1;

            const centerPos = context.placementHelper.tryPlace(
                z, z, this.entityRadius, this.waterPlacement
            );

            if (centerPos) {
                for (let j = 0; j < clusterSize; j++) {
                    let x = centerPos.x;
                    let cz = centerPos.z;

                    if (clusterSize > 1) {
                        x += (Math.random() - 0.5) * cluster.distance;
                        cz += (Math.random() - 0.5) * cluster.distance;
                    }

                    const angle = Math.random() * Math.PI * 2;
                    const entity = this.spawnEntity(context.physicsEngine, {
                        x,
                        y: cz,
                        height: this.heightInWater,
                        angle
                    });
                    if (entity)
                        context.entityManager.add(entity, context.chunkIndex);
                }
                return true;
            }
        }
        return false;
    }
}
