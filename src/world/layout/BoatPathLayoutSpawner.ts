import { PopulationContext } from '../biomes/PopulationContext';
import { BiomeType } from '../biomes/BiomeType';
import { BoatPathLayout } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { RiverGeometry } from '../RiverGeometry';

export class BoatPathLayoutSpawner {
    private static instance: BoatPathLayoutSpawner;

    public static getInstance(): BoatPathLayoutSpawner {
        if (!BoatPathLayoutSpawner.instance) {
            BoatPathLayoutSpawner.instance = new BoatPathLayoutSpawner();
        }
        return BoatPathLayoutSpawner.instance;
    }

    /**
     * Spawns entities for a given BoatPathLayout within a specific Z range.
     * Consolidates spawning logic from all biomes into a single place.
     */
    public *spawnIterator(
        context: PopulationContext,
        layout: BoatPathLayout,
        biomeType: BiomeType,
        zStart: number,
        zEnd: number,
        biomeZRange: [number, number]
    ): Generator<void | Promise<void>, void, unknown> {
        if (!layout) return;

        const zMin = Math.min(zStart, zEnd);
        const zMax = Math.max(zStart, zEnd);

        // Gatekeeping: identify needed models and ensure all loaded
        const seenIds = new Set<EntityIds>();
        for (const p of layout.placements) {
            // Use world Z for filtering consistent with TerrainDecorator
            if (p.z >= zMin && p.z < zMax) {
                if (!seenIds.has(p.id)) {
                    yield* p.ensureLoaded();
                    seenIds.add(p.id);
                }
            }
        }

        let countSinceYield = 0;

        for (const p of layout.placements) {
            // Check if placement is within current segment
            if (p.z >= zMin && p.z < zMax) {
                countSinceYield++;
                if (countSinceYield > 10) {
                    yield;
                    countSinceYield = 0;
                }

                const sample = RiverGeometry.getPathPoint(layout.path, p.index);
                p.spawn(context, sample);
            }
        }
    }
}

