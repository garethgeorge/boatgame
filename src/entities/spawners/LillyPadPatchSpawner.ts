
import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { LillyPadPatch } from '../../entities/obstacles/LillyPadPatch';
import { RiverGeometrySample } from '../../world/RiverGeometry';
import { EntityIds } from '../EntityIds';

export class LillyPadPatchSpawner extends BaseSpawner {
    id = EntityIds.LILLY_PAD_PATCH;

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.005;
    }

    spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
        return false;
    }

    spawnInRiverAbsolute(
        context: SpawnContext,
        sample: RiverGeometrySample,
        distanceRange: [number, number]
    ): boolean {
        // Lilly pad patches are typically smaller and rounder than reed patches
        // User requested ~2x bigger
        const length = 16.0 + Math.random() * 16.0; 
        const width = 16.0 + Math.random() * 16.0; 
        
        const radius = Math.max(width, length) / 2.0;
        // Console log enabled for debugging
        // console.log('LillyPadPatchSpawner: Attempting spawn', { z: sample.centerPos.z, radius, distRange: distanceRange });
        const minSpacing = radius * 1.5;
        const minDistFromShore = 1.0; 

        const pos = context.placementHelper.tryRiverPlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minDistFromShore,
            distanceRange
        );

        if (pos) {
            const rotation = Math.atan2(sample.tangent.z, sample.tangent.x) - Math.PI / 2;
            const patch = new LillyPadPatch(pos.worldX, pos.worldZ, width, length, rotation, context.physicsEngine);
            context.entityManager.add(patch);
            return true;
        }
        return false;
    }
}
