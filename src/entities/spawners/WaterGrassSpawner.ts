import * as THREE from 'three';
import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';
import { WaterGrass } from '../../entities/obstacles/WaterGrass';
import { RiverGeometrySample } from '../../world/RiverGeometry';

export class WaterGrassSpawner extends BaseSpawner {
    id = 'water_grass';

    protected getDensity(difficulty: number, zStart: number): number {
        // Density logic is usually overridden by Layout settings in BiomeFeatures
        // But for fallback or random spawning:
        return 0.005;
    }

    *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        const promise = WaterGrass.preload();
        if (promise) yield promise;
    }

    spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
        // Fallback simple spawn logic if not driven by layout
        // Bias towards shores
        const isShore = Math.random() < 0.8;
        const side = Math.random() > 0.5 ? 1 : -1;
        // Near shore: 0.5 to 0.9 range roughly
        const range: [number, number] = isShore ? [side * 0.6, side * 0.95] : [-0.3, 0.3];

        // Pass dummy sample or implement spawnInRiver helpers that don't need absolute sample?
        // BaseSpawner spawnAt is rarely used if using Layouts.
        return false;
    }

    spawnInRiverAbsolute(
        context: SpawnContext,
        sample: RiverGeometrySample,
        distanceRange: [number, number]
    ): boolean {
        // Randomize dimensions
        // Long and narrow along the river flow? 
        // Or oval? "Reed patches should be shaped like an oval"
        // Let's say length 4-10m, width 2-5m
        // Increased size by ~5x as requested
        const length = 20.0 + Math.random() * 30.0;
        const width = 10.0 + Math.random() * 15.0;

        // Radius for collision check (approximate as max dimension / 2)
        const radius = Math.max(width, length) / 2.0;

        const minSpacing = radius * 1.5;
        // Allow spawning closer to shore, so small dist from shore
        const minDistFromShore = 0.5;

        const pos = context.placementHelper.tryRiverPlaceAbsolute(
            sample,
            radius,
            minSpacing,
            minDistFromShore,
            distanceRange
        );

        if (pos) {
            const rotation = Math.atan2(sample.tangent.z, sample.tangent.x) - Math.PI / 2;

            const grass = new WaterGrass(pos.worldX, pos.worldZ, width, length, rotation, context.physicsEngine);

            context.entityManager.add(grass);
            return true;
        }
        return false;
    }
}
