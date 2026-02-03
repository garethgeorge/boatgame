import { SpawnContext } from '../../../entities/Spawnable';
import { BiomeType } from '../BiomeType';
import { BoatPathLayout } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../../entities/EntityIds';
import { RiverGeometry } from '../../RiverGeometry';
import { RiverSystem } from '../../RiverSystem';
import * as THREE from 'three';
import { AnimalPlacementOptions, EntitySpawnConfig } from './EntityLayoutRules';
import { DecorationId, Decorations } from '../../Decorations';



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
        context: SpawnContext,
        layout: BoatPathLayout,
        biomeType: BiomeType,
        zStart: number,
        zEnd: number,
        biomeZRange: [number, number]
    ): Generator<void | Promise<void>, void, unknown> {
        if (!layout) return;

        const iChunkStart = RiverGeometry.getPathIndexByZ(layout.path, zStart);
        const iChunkEnd = RiverGeometry.getPathIndexByZ(layout.path, zEnd);
        const iChunkMin = Math.min(iChunkStart, iChunkEnd);
        const iChunkMax = Math.max(iChunkStart, iChunkEnd);

        // Gatekeeping: identify needed models and ensure all loaded
        const neededIds = new Map<EntityIds, EntitySpawnConfig>();
        for (const p of layout.placements) {
            if (p.index >= iChunkMin && p.index < iChunkMax &&
                !neededIds.has(p.entity.config.id)) {
                neededIds.set(p.entity.config.id, p.entity.config);
            }
        }
        for (const [id, config] of neededIds) {
            yield* config.ensureLoaded();
        }

        let countSinceYield = 0;

        for (const p of layout.placements) {
            // Check if placement is within current segment
            if (p.index >= iChunkMin && p.index < iChunkMax) {
                countSinceYield++;
                if (countSinceYield > 10) {
                    yield;
                    countSinceYield = 0;
                }

                const sample = RiverGeometry.getPathPoint(layout.path, p.index);
                p.entity.config.spawn(context, p.entity, sample, p.offset);
            }
        }
    }
}
