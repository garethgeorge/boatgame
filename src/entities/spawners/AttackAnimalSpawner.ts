import * as THREE from 'three';
import { Spawnable, SpawnContext } from '../Spawnable';
import { RiverGeometrySample, RiverSystem } from '../../world/RiverSystem';
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
        const isShore = Math.random() < this.shoreProbability;

        if (isShore) {
            const stayOnShore = Math.random() > 0.5;
            return this.spawnOnShore(context, z, stayOnShore, {});
        } else {
            const cluster = this.clusterPlacement;
            const spawnCluster = Math.random() < cluster.probability;
            return this.spawnInRiver(context, z, spawnCluster, {});
        }
    }

    /**
     * Spawns an animal. If the range is outside of [-1,1] first tries to
     * spawn on shore. Only one of the two limits should be outside.
     */
    async spawnAnimal(context: SpawnContext, z: number, range: [number, number]): Promise<boolean> {
        let spawned = false;
        if (range[0] < -1) {
            spawned = await this.spawnOnShore(context, z, false, { side: -1 });
        } else if (range[1] > 1) {
            spawned = await this.spawnOnShore(context, z, false, { side: 1 });
        }
        if (!spawned)
            spawned = await this.spawnInRiver(context, z, false, { range: range });
        return spawned;
    }

    async spawnAnimalAbsolute(
        context: SpawnContext,
        sample: RiverGeometrySample,
        distanceRange: [number, number]
    ): Promise<boolean> {
        let placement: any = null;

        const stayOnShore = false;
        const radius = this.entityRadius;
        const minSpacing = this.waterPlacement.minDistFromOthers || 2.0;
        const minWaterDist = this.waterPlacement.minDistFromBank || 2.0;
        const minShoreDist = this.shorePlacement.minDistFromBank || 2.0;
        const maxSlopeDegrees = this.shorePlacement.maxSlopeDegrees || 20.0;

        // Check if range overlaps shore
        // Negative d is left, positive d is right.
        const overlapsShore = distanceRange[0] < -sample.leftBankDist - minShoreDist || distanceRange[1] > sample.rightBankDist + minShoreDist;

        let onShore = true;
        if (overlapsShore) {
            placement = context.placementHelper.tryShorePlaceAbsolute(
                sample,
                radius,
                minSpacing,
                minShoreDist,
                distanceRange,
                maxSlopeDegrees
            );
        }

        if (!placement) {
            onShore = false;
            const riverPos = context.placementHelper.tryRiverPlaceAbsolute(
                sample,
                radius,
                minSpacing,
                minWaterDist,
                distanceRange
            );
            if (riverPos) {
                placement = {
                    worldX: riverPos.worldX,
                    worldZ: riverPos.worldZ,
                    height: 0,
                    rotation: Math.random() * Math.PI * 2,
                    normal: new THREE.Vector3(0, 1, 0)
                };
            }
        }

        if (placement) {
            const entity = this.spawnEntity(context.physicsEngine, {
                x: placement.worldX,
                y: placement.worldZ,
                angle: placement.rotation,
                height: placement.height,
                terrainNormal: placement.normal,
                onShore,
                stayOnShore
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }

    async spawnInRiver(context: SpawnContext, z: number, spawnCluster: boolean,
        options: RiverPlacementOptions): Promise<boolean> {

        const opts = {
            ...this.waterPlacement,
            ...options
        };

        const cluster = this.clusterPlacement;
        const clusterSize = spawnCluster ? cluster.size : 1;

        const centerPos = context.placementHelper.tryPlace(
            z, z, this.entityRadius, opts
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
                    context.entityManager.add(entity);
            }
            return true;
        }
        return false;
    }

    async spawnOnShore(context: SpawnContext, z: number, stayOnShore: boolean,
        options: ShorePlacementOptions): Promise<boolean> {

        const opts = {
            ...this.shorePlacement,
            ...options
        };

        const riverSystem = RiverSystem.getInstance();
        const placement = context.placementHelper.findShorePlacement(
            z, z, riverSystem, opts
        );

        if (placement) {
            const entity = this.spawnEntity(context.physicsEngine, {
                x: placement.worldX,
                y: placement.worldZ,
                angle: placement.rotation,
                height: placement.height,
                terrainNormal: placement.normal,
                onShore: true,
                stayOnShore
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }
}
