import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType, SpawnContext } from '../../entities/Spawnable';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { MangroveSpawner } from '../../entities/spawners/MangroveSpawner';
import { Decorations } from '../Decorations';

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';

    private mangroveSpawner = new MangroveSpawner();

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            if (Math.random() > 0.5) continue;
            const position = this.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!this.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rock = Decorations.getRock(this.id, Math.random());
            this.decoHelper.positionAndCollectGeometry(rock, position, context);
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await this.spawnObstacle(this.logSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.rockSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.bottleSpawner, context, difficulty, zStart, zEnd);

        await this.spawnObstacle(this.mangroveSpawner, context, difficulty, zStart, zEnd);
    }
}
