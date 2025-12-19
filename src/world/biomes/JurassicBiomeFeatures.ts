import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType, SpawnContext } from '../../entities/Spawnable';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { TRexSpawner } from '../../entities/spawners/TRexSpawner';
import { TriceratopsSpawner } from '../../entities/spawners/TriceratopsSpawner';
import { BrontosaurusSpawner } from '../../entities/spawners/BrontosaurusSpawner';

export class JurassicBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'jurassic';

    private trexSpawner = new TRexSpawner();
    private triceratopsSpawner = new TriceratopsSpawner();
    private brontoSpawner = new BrontosaurusSpawner();

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 20); // Denser

        for (let i = 0; i < count; i++) {
            const position = this.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!this.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rand = Math.random();
            if (rand > 0.8) {
                const cycad = Decorations.getCycad();
                this.decoHelper.positionAndCollectGeometry(cycad, position, context);
            } else if (rand > 0.6) {
                const fern = Decorations.getTreeFern();
                this.decoHelper.positionAndCollectGeometry(fern, position, context);
            } else if (rand > 0.55) {
                const rock = Decorations.getRock(this.id, Math.random());
                this.decoHelper.positionAndCollectGeometry(rock, position, context);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await this.spawnObstacle(this.logSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.rockSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.bottleSpawner, context, difficulty, zStart, zEnd);

        // Dinosaurs
        await this.spawnObstacle(this.trexSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.triceratopsSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.brontoSpawner, context, difficulty, zStart, zEnd);
    }
}
