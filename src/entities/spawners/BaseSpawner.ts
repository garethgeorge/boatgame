import { Spawnable, SpawnContext } from '../Spawnable';
import { RiverSystem } from '../../world/RiverSystem';

export abstract class BaseSpawner implements Spawnable {
    abstract id: string;

    protected abstract getDensity(difficulty: number, zStart: number): number;

    getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
        const chunkLength = zEnd - zStart;
        const density = this.getDensity(difficulty, zStart);

        // Scale by River Width
        // Baseline width is ~45 (Median of 15 and 75)
        // Denser spawns in wider areas, sparser in narrow areas
        const riverSystem = RiverSystem.getInstance();
        const width = (riverSystem.getRiverWidth(zStart) + riverSystem.getRiverWidth(zEnd)) / 2;
        const baselineWidth = riverSystem.MAX_WIDTH;
        const widthMultiplier = width / baselineWidth;

        const count = chunkLength * density * widthMultiplier;

        // Use floor(count + random) to handle fractional parts probabilistically
        return Math.floor(count + Math.random());
    }

    *spawn(context: SpawnContext, count: number, zStart: number, zEnd: number, biomeZRange: [number, number]): Generator<void, void, unknown> {
        for (let i = 0; i < count; i++) {
            if (i % 5 === 0) yield;
            const z = zStart + Math.random() * (zEnd - zStart);
            this.spawnAt(context, z, biomeZRange);
        }
    }

    /**
     * Spawn an instance at the specified z value. The details are
     * type specific. It can be on shore or in river, could be a
     * cluster or single instance etc
     */
    abstract spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean | Promise<boolean>;
}
