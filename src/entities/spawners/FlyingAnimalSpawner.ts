import { SpawnContext } from '../Spawnable';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverGeometrySample } from '../../world/RiverGeometry';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { FlyingAnimalOptions } from '../obstacles/FlyingAnimal';
import { Entity } from '../../core/Entity';
import { ShorePlacementOptions } from '../../managers/PlacementHelper';
import { BaseSpawner } from './BaseSpawner';

export abstract class FlyingAnimalSpawner extends BaseSpawner {

    protected get entityRadius(): number {
        return 3.0;
    }

    protected get shorePlacement(): ShorePlacementOptions {
        return { minDistFromBank: 2.0, maxDistFromBank: 8.0 };
    }

    protected abstract spawnEntity(physicsEngine: PhysicsEngine,
        options: FlyingAnimalOptions): Entity;

    async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
        // For now, only spawn on shore
        return this.spawnOnShore(context, z, {});
    }

    /**
     * Spawns a flying animal on shore near a given river sample.
     */
    async spawnAnimalAbsolute(
        context: SpawnContext,
        sample: RiverGeometrySample,
        distanceRange: [number, number],
        aggressiveness: number
    ): Promise<boolean> {
        const radius = this.entityRadius;
        const minSpacing = 2.0; // Default
        const minShoreDist = this.shorePlacement.minDistFromBank || 2.0;
        const maxSlopeDegrees = this.shorePlacement.maxSlopeDegrees || 20.0;

        const placement = context.placementHelper.tryShorePlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minShoreDist,
            distanceRange,
            maxSlopeDegrees
        );

        if (placement) {
            const entity = this.spawnEntity(context.physicsEngine, {
                x: placement.worldX,
                y: placement.worldZ,
                angle: placement.rotation,
                height: placement.height,
                terrainNormal: placement.normal,
                aggressiveness
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }

    async spawnOnShore(context: SpawnContext, z: number,
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
            });
            if (entity) {
                context.entityManager.add(entity);
                return true;
            }
        }
        return false;
    }
}
