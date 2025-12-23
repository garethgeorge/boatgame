import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { MangroveSpawner } from '../../entities/spawners/MangroveSpawner';
import { Decorations } from '../Decorations';
import { LogSpawner } from '../../entities/spawners/LogSpawner';

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';

    protected mangroveSpawner = new MangroveSpawner();
    protected logSpawner = new LogSpawner(0.003 * 5);

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x2B / 255, g: 0x24 / 255, b: 0x1C / 255 }; // Muddy Dark Brown
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xB0 / 255, g: 0xA0 / 255, b: 0xD0 / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 300 };
    }

    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color } {
        const colors = super.getSkyColors(dayness);
        if (dayness > 0) {
            const swampTopMod = new THREE.Color(0x776655); // Muted Brown/Purple
            const swampBotMod = new THREE.Color(0x5D5346); // Earthen Tone (Matches Banks)
            colors.top.lerp(swampTopMod, 0.8);
            colors.bottom.lerp(swampBotMod, 0.9); // Strong influence for fog color
        }
        return colors;
    }

    getAmplitudeMultiplier(): number {
        return 0.1;
    }

    getRiverWidthMultiplier(): number {
        return 5.0;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            if (Math.random() > 0.5) continue;
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rock = Decorations.getRock(this.id, Math.random());
            context.decoHelper.positionAndCollectGeometry(rock, position, context);
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await this.spawnObstacle(this.logSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.rockSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.bottleSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.mangroveSpawner, context, difficulty, zStart, zEnd);
    }
}
