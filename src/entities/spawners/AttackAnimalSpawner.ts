import * as THREE from 'three';
import { Spawnable, SpawnContext } from '../Spawnable';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverGeometry, RiverGeometrySample } from '../../world/RiverGeometry';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions, ShorePlacementOptions } from '../../managers/PlacementHelper';
import { BaseSpawner } from './BaseSpawner';

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
        const sample = RiverGeometry.getRiverGeometrySample(riverSystem, z);

        const isShore = Math.random() < this.shoreProbability;
        const aggro = Math.random();

        if (isShore) {
            const shorePlace = this.shorePlacement;
            const stayOnShore = Math.random() > 0.5;
            const left = Math.random() < 0.5;
            const range: [number, number] = left ?
                [-sample.bankDist - shorePlace.maxDistFromBank, -sample.bankDist] :
                [sample.bankDist, sample.bankDist + shorePlace.maxDistFromBank];
            return this.spawnAnimalAbsolute(context, sample, range, aggro);

        } else {
            const range: [number, number] = [-sample.bankDist, sample.bankDist];
            return this.spawnAnimalAbsolute(context, sample, range, aggro);
        }
    }

    /**
     * Spawns an animal within a distance range from a river position.
     * If the range includes the shore prefers finding an on shore
     * position. 
     */
    async spawnAnimalAbsolute(
        context: SpawnContext,
        sample: RiverGeometrySample,
        distanceRange: [number, number],
        aggressiveness: number,
        attackLogicName?: string
    ): Promise<boolean> {
        let placement: any = null;

        const stayOnShore = false;
        const radius = this.entityRadius;
        const minSpacing = this.waterPlacement.minDistFromOthers || 2.0;
        const minWaterDist = this.waterPlacement.minDistFromBank || 2.0;
        const minShoreDist = this.shorePlacement.minDistFromBank || 2.0;
        const maxSlopeDegrees = this.shorePlacement.maxSlopeDegrees || 20.0;

        // Check if range overlaps shore
        const overlapsShore = distanceRange[0] < -sample.bankDist - minShoreDist || distanceRange[1] > sample.bankDist + minShoreDist;

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
                    height: this.heightInWater,
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
                stayOnShore,
                aggressiveness,
                attackLogicName
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }
}
