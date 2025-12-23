import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { BrownBearSpawner } from '../../entities/spawners/BrownBearSpawner';
import { MooseSpawner } from '../../entities/spawners/MooseSpawner';
import { DucklingSpawner } from '../../entities/spawners/DucklingSpawner';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';

    private bearSpawner = new BrownBearSpawner();
    private mooseSpawner = new MooseSpawner();
    private ducklingSpawner = new DucklingSpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 };
    }

    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color } {
        const colors = super.getSkyColors(dayness);
        if (dayness > 0) {
            const forestTopMod = new THREE.Color(0x4488ff); // Crisp Blue
            const forestBotMod = new THREE.Color(0xcceeff); // White/Blue Horizon
            colors.top.lerp(forestTopMod, 0.6);
            colors.bottom.lerp(forestBotMod, 0.6);
        }
        return colors;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            if (Math.random() > 0.8) {
                const tree = Decorations.getTree(Math.random(), false, false);
                context.decoHelper.positionAndCollectGeometry(tree, position, context);
            } else if (Math.random() > 0.95) {
                const rock = Decorations.getRock(this.id, Math.random());
                context.decoHelper.positionAndCollectGeometry(rock, position, context);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await this.spawnObstacle(this.logSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.rockSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.buoySpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.bottleSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.pierSpawner, context, difficulty, zStart, zEnd);

        // Brown Bears
        await this.spawnObstacle(this.bearSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.mooseSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.ducklingSpawner, context, difficulty, zStart, zEnd);
    }
}
