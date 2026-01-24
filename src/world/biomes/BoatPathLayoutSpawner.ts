import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { BoatPathLayout } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { RiverGeometry } from '../RiverGeometry';
import { EntitySpawners } from '../../entities/spawners/EntitySpawners';
import { AttackLogicName } from '../../entities/obstacles/AttackAnimal';

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
        zEnd: number
    ): Generator<void, void, unknown> {
        if (!layout) return;

        // Map world Z range to path indices
        const iChunkStart = RiverGeometry.getPathIndexByZ(layout.path, zStart);
        const iChunkEnd = RiverGeometry.getPathIndexByZ(layout.path, zEnd);

        const iChunkMin = Math.min(iChunkStart, iChunkEnd);
        const iChunkMax = Math.max(iChunkStart, iChunkEnd);

        const spawners = EntitySpawners.getInstance();

        let countSinceYield = 0;
        for (const section of layout.sections) {
            // Check if section overlaps with current segment arc length range
            if (section.iEnd <= iChunkMin || section.iStart >= iChunkMax) {
                continue;
            }

            // Iterate through each entity type in the section
            for (const [entityTypeStr, placements] of Object.entries(section.placements)) {
                if (!placements) continue;
                const entityType = entityTypeStr as EntityIds;

                for (const p of placements) {
                    countSinceYield++;
                    if (countSinceYield > 10) {
                        yield;
                        countSinceYield = 0;
                    }

                    // Check if placement is within current segment
                    if (p.index >= iChunkMin && p.index < iChunkMax) {
                        const sample = RiverGeometry.getPathPoint(layout.path, p.index);

                        switch (entityType) {
                            case EntityIds.LOG:
                                // spawner.spawnInRiverAbsolute is already async but we treat it as sync-ish here
                                // since it's just physics body creation which is fast per-call.
                                // If physics creation becomes slow we can make spawners async too.
                                spawners.log().spawnInRiverAbsolute(context, sample, p.range);
                                break;

                            case EntityIds.ROCK: {
                                let pillars = false;
                                if (biomeType === 'forest') pillars = Math.random() < 0.1;
                                else if (biomeType === 'desert') pillars = Math.random() < 0.3;

                                spawners.rock().spawnInRiverAbsolute(
                                    context, sample, pillars, biomeType as any, p.range
                                );
                                break;
                            }

                            case EntityIds.BUOY:
                                spawners.buoy().spawnInRiverAbsolute(context, sample, p.range);
                                break;

                            case EntityIds.BOTTLE:
                                spawners.messageInABottle().spawnInRiverAbsolute(context, sample, p.range);
                                break;

                            case EntityIds.PIER: {
                                const onLeft = biomeType === 'desert' ? true : Math.random() < 0.5;
                                spawners.pier().spawnAt(context, sample.centerPos.z, onLeft);
                                break;
                            }

                            case EntityIds.MANGROVE: {
                                const offset = p.range[0] + Math.random() * (p.range[1] - p.range[0]);
                                spawners.mangrove().spawnAbsolute(
                                    context,
                                    sample.centerPos.x + sample.normal.x * offset,
                                    sample.centerPos.z + sample.normal.z * offset
                                );
                                break;
                            }

                            case EntityIds.WATER_GRASS:
                                spawners.waterGrass().spawnInRiverAbsolute(context, sample, p.range);
                                break;

                            case EntityIds.ALLIGATOR:
                            case EntityIds.MONKEY:
                            case EntityIds.HIPPO:
                            case EntityIds.TREX:
                            case EntityIds.TRICERATOPS:
                            case EntityIds.BRONTOSAURUS:
                            case EntityIds.MOOSE:
                            case EntityIds.BROWN_BEAR:
                            case EntityIds.POLAR_BEAR:
                            case EntityIds.DUCKLING:
                            case EntityIds.DOLPHIN:
                            case EntityIds.SWAN:
                            case EntityIds.PENGUIN_KAYAK:
                            case EntityIds.BUTTERFLY:
                            case EntityIds.PTERODACTYL:
                            case EntityIds.BLUEBIRD:
                            case EntityIds.EGRET:
                            case EntityIds.DRAGONFLY: {
                                let logic: AttackLogicName | undefined = undefined;
                                let range = p.range;

                                if (biomeType === 'desert') {
                                    logic = Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack';
                                } else if (biomeType === 'swamp' && entityType === EntityIds.ALLIGATOR) {
                                    logic = 'AmbushAttack';
                                    range = [-10, 10];
                                }

                                const spawner = spawners.animal(entityType);
                                if (spawner) {
                                    spawner.spawnAnimalAbsolute({
                                        context,
                                        sample,
                                        distanceRange: range,
                                        aggressiveness: p.aggressiveness || 0.5,
                                        logic
                                    });
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}
