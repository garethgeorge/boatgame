import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { RiverPlacementBias } from '../../managers/PlacementHelper';

interface DesertObstacle {
    type: 'rock' | 'bottle' | 'gator' | 'hippo' | 'monkey';
    weight: number;
}

interface DesertSpawnRun {
    zOffsetStart: number;
    zOffsetEnd: number;
    bias: RiverPlacementBias;
    obstacles: DesertObstacle[];
}

interface DesertBiomeLayout {
    runs: DesertSpawnRun[];
}

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

    public createLayout(length: number): DesertBiomeLayout {
        const runLength = 100; // 20 100m runs, 0,0.05,0.1,0.15,0.2 ...
        const runs: DesertSpawnRun[] = [];

        for (let z = 0; z < length; z += runLength) {
            const zEnd = Math.min(z + runLength, length);
            const t = z / length;

            const rBias = Math.random();
            const bias: RiverPlacementBias = rBias < 0.4 ? 'left' : (rBias < 0.6 ? 'right' : 'none');

            const obstacles: DesertObstacle[] = [];

            if (t < 0.2) {
                // Phase 1: Arrival - Easy, bottles and rocks
                obstacles.push({ type: 'rock', weight: 0.2 });
                obstacles.push({ type: 'bottle', weight: 0.2 });
            } else if (t < 0.4) {
                // Phase 2: Shore Life - Monkeys on shore, rocks/bottles in water
                obstacles.push({ type: 'rock', weight: 0.2 });
                obstacles.push({ type: 'bottle', weight: 0.1 });
                obstacles.push({ type: 'monkey', weight: 0.3 });
            } else if (t < 0.6) {
                // Phase 3: The Crossing - Clustering, hippos
                obstacles.push({ type: 'rock', weight: 0.2 });
                obstacles.push({ type: 'bottle', weight: 0.1 });
                obstacles.push({ type: 'hippo', weight: 0.3 });
            } else if (t < 0.85) {
                // Phase 4: The Gauntlet - Higher density, alligators
                obstacles.push({ type: 'rock', weight: 0.2 });
                obstacles.push({ type: 'bottle', weight: 0.1 });
                obstacles.push({ type: 'hippo', weight: 0.2 });
                obstacles.push({ type: 'gator', weight: 0.2 });
            } else {
                // Phase 5: bottles and depot
            }

            runs.push({
                zOffsetStart: z,
                zOffsetEnd: zEnd,
                bias,
                obstacles
            });
        }

        return { runs };
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
        const layout = context.biomeLayout as DesertBiomeLayout;

        if (count > 0) {
            const subIntervalLength = length / count;

            for (let i = 0; i < count; i++) {
                // Determine z in this chunk segment
                const z = zStart + i * subIntervalLength + Math.random() * subIntervalLength;

                // Find current run from layout
                const zOffset = Math.abs(z - biomeEntranceZ);
                const run = layout.runs.find(r => zOffset >= r.zOffsetStart && zOffset < r.zOffsetEnd) || layout.runs[0];

                const currentBias = run.bias;

                if (run.obstacles.length > 0) {
                    // random selection
                    let r = Math.random();
                    let selectedType: string | null = null;

                    for (const obs of run.obstacles) {
                        r -= obs.weight;
                        if (r <= 0) {
                            selectedType = obs.type;
                            break;
                        }
                    }

                    if (selectedType === 'rock') {
                        await this.rockSpawner.spawnRiverRock(context, z, currentBias);
                    } else if (selectedType === 'bottle') {
                        await this.bottleSpawner.spawnRiverBottle(context, z, currentBias);
                    } else if (selectedType === 'monkey') {
                        await this.monkeySpawner.spawnShoreAnimal(context, z);
                    } else if (selectedType === 'hippo') {
                        await this.hippoSpawner.spawnRiverAnimal(context, z, false, currentBias);
                    } else if (selectedType === 'gator') {
                        await this.alligatorSpawner.spawnRiverAnimal(context, z, false, currentBias);
                    }
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
            await this.bottleSpawner.spawnRiverBottleArc(context, 6, pierZ, 15);
        }
    }
}
