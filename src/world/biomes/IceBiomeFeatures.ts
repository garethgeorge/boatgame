import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType, SpawnContext } from '../../entities/Spawnable';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { IcebergSpawner } from '../../entities/spawners/IcebergSpawner';
import { PolarBearSpawner } from '../../entities/spawners/PolarBearSpawner';
import { PenguinKayakSpawner } from '../../entities/spawners/PenguinKayakSpawner';

export class IceBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'ice';

    private icebergSpawner = new IcebergSpawner();
    private polarBearSpawner = new PolarBearSpawner();
    private penguinKayakSpawner = new PenguinKayakSpawner();

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            const position = this.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!this.decoHelper.isValidDecorationPosition(context, position)) continue;

            if (Math.random() > 0.8) {
                const isLeafless = Math.random() > 0.5;
                const tree = Decorations.getTree(Math.random(), !isLeafless, isLeafless);
                this.decoHelper.positionAndCollectGeometry(tree, position, context);
            } else if (Math.random() > 0.9) {
                const rock = Decorations.getRock(this.id, Math.random());
                this.decoHelper.positionAndCollectGeometry(rock, position, context);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await this.spawnObstacle(this.buoySpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.bottleSpawner, context, difficulty, zStart, zEnd);

        await this.spawnObstacle(this.icebergSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.penguinKayakSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.polarBearSpawner, context, difficulty, zStart, zEnd);
    }
}
