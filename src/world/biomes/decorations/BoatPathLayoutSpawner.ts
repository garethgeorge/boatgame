import { SpawnContext } from '../../../entities/Spawnable';
import { BiomeType } from '../BiomeType';
import { BoatPathLayout } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../../entities/EntityIds';
import { RiverGeometry } from '../../RiverGeometry';
import { EntitySpawners } from '../../../entities/EntitySpawners';
import { AnimalBehaviorConfig } from '../../../entities/behaviors/AnimalBehaviorConfigs';
import { AnimalPlacementOptions } from './EntityLayoutRules';



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

        const spawners = EntitySpawners.getInstance();

        const iChunkStart = RiverGeometry.getPathIndexByZ(layout.path, zStart);
        const iChunkEnd = RiverGeometry.getPathIndexByZ(layout.path, zEnd);
        const iChunkMin = Math.min(iChunkStart, iChunkEnd);
        const iChunkMax = Math.max(iChunkStart, iChunkEnd);

        // Gatekeeping: identify needed models and ensure all loaded
        const neededIds = new Set<EntityIds>();
        for (const p of layout.placements) {
            if (p.index >= iChunkMin && p.index < iChunkMax) {
                neededIds.add(p.entity.type);
            }
        }
        yield* spawners.ensureAllLoaded(Array.from(neededIds));

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

                switch (p.entity.type) {
                    case EntityIds.LOG:
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
                        spawners.pier().spawnAt(context, sample.centerPos.z, biomeZRange, onLeft);
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

                    case EntityIds.LILLY_PAD_PATCH:
                        spawners.lillyPadPatch().spawnInRiverAbsolute(context, sample, p.range);
                        break;

                    case EntityIds.ALLIGATOR:
                    case EntityIds.BLUEBIRD:
                    case EntityIds.BRONTOSAURUS:
                    case EntityIds.BROWN_BEAR:
                    case EntityIds.BUTTERFLY:
                    case EntityIds.DOLPHIN:
                    case EntityIds.DRAGONFLY:
                    case EntityIds.DUCKLING:
                    case EntityIds.EGRET:
                    case EntityIds.HIPPO:
                    case EntityIds.MONKEY:
                    case EntityIds.MOOSE:
                    case EntityIds.PENGUIN_KAYAK:
                    case EntityIds.POLAR_BEAR:
                    case EntityIds.PTERODACTYL:
                    case EntityIds.SNAKE:
                    case EntityIds.SWAN:
                    case EntityIds.TREX:
                    case EntityIds.TRICERATOPS:
                    case EntityIds.TURTLE:
                    case EntityIds.UNICORN:
                    case EntityIds.GINGERMAN: {
                        const animal = p.entity as AnimalPlacementOptions;
                        const animalSpawner = spawners.animal(animal.type);
                        if (animalSpawner) {
                            const baseOptions = {
                                distanceRange: p.range,
                                aggressiveness: p.aggressiveness || 0.5,
                                biomeZRange
                            };

                            const landOptions = animal.options ? animal.options('land') : {};
                            const spawned = animalSpawner.spawnOnLand(context, sample, {
                                ...baseOptions,
                                ...landOptions
                            });
                            if (!spawned) {
                                const riverOptions = animal.options ? animal.options('water') : {};
                                animalSpawner.spawnInRiver(context, sample, {
                                    ...baseOptions,
                                    ...riverOptions
                                });
                            }
                        }
                        break;
                    }
                }
            }
        }
    }
}
