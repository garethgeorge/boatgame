import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { MessageInABottle } from '../../entities/obstacles/MessageInABottle';
import { RiverPlacementBias } from '../../managers/PlacementHelper';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';

    private alligatorSpawner = new AlligatorSpawner();
    private hippoSpawner = new HippoSpawner();
    private monkeySpawner = new MonkeySpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
    }

    public getBiomeLength(): number {
        return 2000;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rand = Math.random();
            if (rand > 0.95) {
                const cactus = Decorations.getCactus();
                context.decoHelper.positionAndCollectGeometry(cactus, position, context);
            } else if (rand > 0.90) {
                const rock = Decorations.getRock(this.id, Math.random());
                context.decoHelper.positionAndCollectGeometry(rock, position, context);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const length = Math.abs(zEnd - zStart);
        const baseDensity = 0.06;
        const count = Math.floor(length * baseDensity);

        const biomeEntranceZ = Math.max(context.biomeZStart, context.biomeZEnd);
        const biomeExitZ = Math.min(context.biomeZStart, context.biomeZEnd);
        const biomeLength = Math.abs(biomeExitZ - biomeEntranceZ);

        if (count > 0) {
            const subIntervalLength = length / count;

            for (let i = 0; i < count; i++) {
                // Determine z in this chunk segment
                const z = zStart + i * subIntervalLength + Math.random() * subIntervalLength;

                // Parametric distance: 0 at biome entrance (larger Z), 1 at exit (smaller Z)
                const t = Math.min(0.999, Math.max(0, (z - biomeEntranceZ) / (biomeExitZ - biomeEntranceZ)));
                const r = Math.random();

                if (t < 0.2) {
                    // Phase 1: Arrival - Easy, bottles and logs
                    if (r < 0.4) await this.bottleSpawner.spawnRiverBottle(context, z, 'none');
                    else if (r < 0.55) await this.logSpawner.spawnRiverLog(context, z, 'none');
                } else if (t < 0.4) {
                    // Phase 2: Shore Life - Monkeys on shore, some obstacles
                    if (r < 0.3) await this.monkeySpawner.spawnShoreAnimal(context, z);
                    else if (r < 0.5) await this.logSpawner.spawnRiverLog(context, z, 'none');
                    else if (r < 0.6) await this.rockSpawner.spawnRiverRock(context, z, 'none');
                    else if (r < 0.7) await this.bottleSpawner.spawnRiverBottle(context, z, 'none');
                } else if (t < 0.6) {
                    // Phase 3: The Crossing - Clustering every 120m, hippos
                    const bias: RiverPlacementBias = (Math.floor(Math.abs(z) / 120) % 2 === 0) ? 'left' : 'right';
                    if (r < 0.25) await this.logSpawner.spawnRiverLog(context, z, bias);
                    else if (r < 0.5) await this.rockSpawner.spawnRiverRock(context, z, bias);
                    else if (r < 0.7) await this.hippoSpawner.spawnRiverAnimal(context, z, false, 'none');
                    else if (r < 0.8) await this.bottleSpawner.spawnRiverBottle(context, z, 'none');
                } else if (t < 0.85) {
                    // Phase 4: The Gauntlet - Higher density clustering every 80m, alligators
                    const bias: RiverPlacementBias = (Math.floor(Math.abs(z) / 80) % 2 === 0) ? 'left' : 'right';
                    const oppositeBias = bias === 'left' ? 'right' : 'left';
                    if (r < 0.3) await this.logSpawner.spawnRiverLog(context, z, bias);
                    else if (r < 0.6) await this.rockSpawner.spawnRiverRock(context, z, bias);
                    else if (r < 0.8) await this.alligatorSpawner.spawnRiverAnimal(context, z, false, 'none');
                    else if (r < 0.95) await this.bottleSpawner.spawnRiverBottle(context, z, oppositeBias);
                }
            }
        }

        // Phase 5: The Destination - Pier at t=0.9
        const pierT = 0.9;
        const pierZ = biomeEntranceZ + pierT * (biomeExitZ - biomeEntranceZ);

        // Check if pierZ is within this chunk segment [zStart, zEnd]
        // Note: zStart is usually smaller (more negative) than zEnd in ObstacleManager calls for negative chunks
        const minZ = Math.min(zStart, zEnd);
        const maxZ = Math.max(zStart, zEnd);

        if (minZ <= pierZ && pierZ < maxZ) {
            await this.pierSpawner.spawnAt(context, pierZ, true);

            // Guiding bottles towards the pier (placed BEFORE the pier in the traversal direction)
            // Traversal is +Z -> -Z. So before pierZ means LARGER Z.
            for (let i = 1; i <= 6; i++) {
                const bz = pierZ + i * 15;
                const pos = context.placementHelper.tryPlace(bz, bz, 1.0, { bias: 'center', biasStrength: 0.5 });
                if (pos) {
                    const bottle = new MessageInABottle(pos.x, pos.z, context.physicsEngine, 0x00FF88, 50);
                    context.entityManager.add(bottle, context.chunkIndex);
                }
            }
        }
    }
}
