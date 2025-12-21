import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../../entities/spawners/HippoSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { BaseSpawner } from '../../entities/spawners/BaseSpawner';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';

    private alligatorSpawner = new AlligatorSpawner();
    private hippoSpawner = new HippoSpawner();
    private monkeySpawner = new MonkeySpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
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
        const length = zEnd - zStart;
        const density = 0.05; // 1 entity every 20m
        const count = Math.floor(length * density);

        if (count <= 0) return;

        const subIntervalLength = length / count;

        // Special case for pier: near the end of the biome
        const pierZ = context.biomeZStart + 0.9 * (context.biomeZEnd - context.biomeZStart);

        // If our current entity's sub-interval contains the pierZ, spawn it.
        if (zStart < pierZ && pierZ <= zEnd) {
            await this.pierSpawner.spawnAt(context, pierZ, true);
        }

        for (let i = 0; i < count; i++) {
            const z = zStart + i * subIntervalLength + Math.random() * subIntervalLength;
            // Parametric distance: 0 at biome entrance, 1 at exit
            const t = Math.min(0.999, Math.max(0, (z - context.biomeZStart) / (context.biomeZEnd - context.biomeZStart)));

            const spawnPool: { spawner: BaseSpawner, probability: number }[] = [];

            // Interval mapping
            if (t < 0.15) {
                spawnPool.push({ spawner: this.logSpawner, probability: 0.2 });
                spawnPool.push({ spawner: this.rockSpawner, probability: 0.1 });
                spawnPool.push({ spawner: this.bottleSpawner, probability: 0.3 });
            } else if (t < 0.8) {
                spawnPool.push({ spawner: this.logSpawner, probability: 0.05 });
                spawnPool.push({ spawner: this.rockSpawner, probability: 0.1 });
                spawnPool.push({ spawner: this.bottleSpawner, probability: 0.3 });
                spawnPool.push({ spawner: this.alligatorSpawner, probability: 0.2 });
                spawnPool.push({ spawner: this.hippoSpawner, probability: 0.1 });
                spawnPool.push({ spawner: this.monkeySpawner, probability: 0.1 });
            } else {
                spawnPool.push({ spawner: this.logSpawner, probability: 0.2 });
                spawnPool.push({ spawner: this.rockSpawner, probability: 0.1 });
            }

            // Randomly choose from pool OR nothing (1 in 4 chance of nothing?)
            // The prompt says "choose between a nothing, a log or a rock", etc.
            // This suggests "nothing" is one of the options.
            if (spawnPool.length > 0) {
                let spawner = undefined;
                const r = Math.random();
                let sum = 0.0;
                for (const entry of spawnPool) {
                    sum += entry.probability;
                    if (r < sum) {
                        spawner = entry.spawner;
                        break;
                    }
                }
                if (spawner !== undefined) {
                    await spawner.spawnAt(context, z);
                }
            }
        }
    }
}
