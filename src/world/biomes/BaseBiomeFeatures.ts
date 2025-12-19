import { BiomeFeatures } from './BiomeFeatures';
import { BiomeType, SpawnContext } from '../../entities/Spawnable';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { BiomeDecorationHelper } from './BiomeDecorationHelper';
import { Decorations } from '../Decorations';
import { LogSpawner } from '../../entities/spawners/LogSpawner';
import { RockSpawner } from '../../entities/spawners/RockSpawner';
import { BuoySpawner } from '../../entities/spawners/BuoySpawner';
import { MessageInABottleSpawner } from '../../entities/spawners/MessageInABottleSpawner';
import { PierSpawner } from '../../entities/spawners/PierSpawner';
import { Spawnable } from '../../entities/Spawnable'

export abstract class BaseBiomeFeatures implements BiomeFeatures {
    abstract id: BiomeType;
    protected decoHelper = new BiomeDecorationHelper();

    // Common Spawners
    protected logSpawner = new LogSpawner();
    protected rockSpawner = new RockSpawner();
    protected buoySpawner = new BuoySpawner();
    protected bottleSpawner = new MessageInABottleSpawner();
    protected pierSpawner = new PierSpawner();

    abstract decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void>;
    abstract spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void>;

    protected async spawnObstacle(spawner: Spawnable, context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const count = spawner.getSpawnCount(context, difficulty, zStart, zEnd);
        await spawner.spawn(context, count, zStart, zEnd);
    }
}
