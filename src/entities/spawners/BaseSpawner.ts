import { Spawnable, SpawnContext } from '../Spawnable';

export abstract class BaseSpawner implements Spawnable {
    abstract id: string;

    protected abstract getDensity(difficulty: number, zStart: number): number;

    getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
        const chunkLength = zEnd - zStart;
        const density = this.getDensity(difficulty, zStart);
        const count = chunkLength * density;

        // Use floor(count + random) to handle fractional parts probabilistically
        return Math.floor(count + Math.random());
    }

    async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const z = zStart + Math.random() * (zEnd - zStart);
            await this.spawnAt(context, z);
        }
    }

    abstract spawnAt(context: SpawnContext, z: number): Promise<boolean>;
}
