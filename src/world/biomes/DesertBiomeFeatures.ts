import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { PlacementBias } from '../../managers/PlacementHelper';

interface DesertObstacle {
    type: 'rock' | 'bottle' | 'gator' | 'hippo' | 'monkey';
    count: number;
    bias: PlacementBias;
    onShore: boolean;
}

interface DesertSpawnRun {
    zOffsetStart: number;
    zOffsetEnd: number;
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
        // 5 phases each of 400 m and divided into 200 m runs
        const phases = [0, 0.2, 0.4, 0.6, 0.85, 1.0];
        const runLength = 200;

        const runs: DesertSpawnRun[] = [];

        // bias will alternate
        let biasA: PlacementBias = Math.random() ? 'left' : 'right';
        let biasB: PlacementBias = biasA === 'left' ? 'right' : 'left';

        for (let z = 0; z < length; z += runLength) {
            const zEnd = Math.min(z + runLength, length);

            [biasA, biasB] = [biasB, biasA];

            // index of phase containing z
            const zFraction = z / length;
            const phaseIndex = phases.findLastIndex(phaseStart => zFraction >= phaseStart);

            const obstacles: DesertObstacle[] = [];

            switch (phaseIndex) {
                case 0: {
                    // Phase 1: Arrival - Easy, bottles and rocks
                    obstacles.push({ type: 'rock', count: 3, bias: biasA, onShore: false });
                    obstacles.push({ type: 'bottle', count: 3, bias: biasB, onShore: false });
                    break;
                }
                case 1: {
                    // Phase 2: Shore Life - Monkeys on shore, rocks/bottles in water
                    obstacles.push({ type: 'rock', count: 2, bias: biasA, onShore: false });
                    obstacles.push({ type: 'bottle', count: 2, bias: biasA, onShore: false });
                    obstacles.push({ type: 'monkey', count: 3, bias: biasA, onShore: true });
                    break;
                }
                case 2: {
                    // Phase 3: The Crossing - Clustering, hippos
                    obstacles.push({ type: 'rock', count: 1, bias: biasA, onShore: false });
                    obstacles.push({ type: 'bottle', count: 1, bias: biasA, onShore: false });
                    obstacles.push({ type: 'hippo', count: 2, bias: biasB, onShore: false });
                    break;
                }
                case 3: {
                    // Phase 4: The Gauntlet - Higher density, alligators
                    obstacles.push({ type: 'rock', count: 1, bias: biasA, onShore: false });
                    obstacles.push({ type: 'bottle', count: 1, bias: biasA, onShore: false });
                    obstacles.push({ type: 'hippo', count: 1, bias: biasA, onShore: false });
                    obstacles.push({ type: 'gator', count: 2, bias: biasA, onShore: true });
                    break;
                }
                case 4: {
                    // Phase 5: bottles and depot
                    break;
                }
            }

            runs.push({
                zOffsetStart: z,
                zOffsetEnd: zEnd,
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
        const biomeEntranceZ = Math.max(context.biomeZStart, context.biomeZEnd);
        const biomeExitZ = Math.min(context.biomeZStart, context.biomeZEnd);
        const layout = context.biomeLayout as DesertBiomeLayout;

        // Current segment boundaries in world Z
        const segmentMinZ = Math.min(zStart, zEnd);
        const segmentMaxZ = Math.max(zStart, zEnd);

        // Find all runs that overlap with this chunk segment [segmentMinZ, segmentMaxZ]
        for (const run of layout.runs) {
            // run.zOffsetStart/End are distances from biomeEntranceZ (usually negative Z)
            // So world Z for run is: biomeEntranceZ - offset (since boat moves to negative Z)
            const runMaxZ = biomeEntranceZ - run.zOffsetStart; // Closer to 0
            const runMinZ = biomeEntranceZ - run.zOffsetEnd;   // Further from 0

            // Intersection of segment [segmentMinZ, segmentMaxZ] and run [runMinZ, runMaxZ]
            const intersectMinZ = Math.max(segmentMinZ, runMinZ);
            const intersectMaxZ = Math.min(segmentMaxZ, runMaxZ);

            if (intersectMinZ < intersectMaxZ) {
                const intersectLength = intersectMaxZ - intersectMinZ;

                const runLength = run.zOffsetEnd - run.zOffsetStart;
                for (const obstacle of run.obstacles) {
                    // expectedCount is total count for the run * fraction of run in this segment
                    const expectedCount = (intersectLength / runLength) * obstacle.count;
                    const count = Math.floor(expectedCount) + (Math.random() < (expectedCount % 1) ? 1 : 0);

                    for (let n = 0; n < count; n++) {
                        const z = intersectMinZ + Math.random() * intersectLength * 0.5;

                        switch (obstacle.type) {
                            case 'rock': {
                                await this.rockSpawner.spawnInRiver(context, z, { bias: obstacle.bias });
                                break;
                            }
                            case 'bottle': {
                                await this.bottleSpawner.spawnInRiver(context, z, { bias: obstacle.bias });
                                break;
                            }
                            case 'monkey': {
                                await this.monkeySpawner.spawnAnimal(context, z, obstacle.bias, obstacle.onShore);
                                break;
                            }
                            case 'hippo': {
                                await this.hippoSpawner.spawnInRiver(context, z, false, { bias: obstacle.bias });
                                break;
                            }
                            case 'gator': {
                                await this.alligatorSpawner.spawnAnimal(context, z, obstacle.bias, obstacle.onShore);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Phase 5: The Destination - Pier at t=0.9
        const pierT = 0.9;
        const pierZ = biomeEntranceZ + pierT * (biomeExitZ - biomeEntranceZ);

        if (segmentMinZ <= pierZ && pierZ < segmentMaxZ) {
            await this.pierSpawner.spawnAt(context, pierZ, true);
            await this.bottleSpawner.spawnRiverBottleArc(context, 6, pierZ, 15);
        }
    }
}
