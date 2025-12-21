import { Color3 } from '@babylonjs/core';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { MangroveSpawner } from '../../entities/spawners/MangroveSpawner';
import { Decorations } from '../Decorations';

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';

    private mangroveSpawner = new MangroveSpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x4d / 255, g: 0x3e / 255, b: 0x30 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xB0 / 255, g: 0xA0 / 255, b: 0xD0 / 255 };
    }

    getFogDensity(): number {
        return 0.8;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 90 };
    }

    getSkyColors(dayness: number): { top: Color3, bottom: Color3 } {
        const colors = super.getSkyColors(dayness);
        if (dayness > 0) {
            const swampTopMod = Color3.FromHexString("#776655"); // Muted Brown/Purple
            const swampBotMod = Color3.FromHexString("#5D5346"); // Earthen Tone (Matches Banks)
            colors.top = Color3.Lerp(colors.top, swampTopMod, 0.8);
            colors.bottom = Color3.Lerp(colors.bottom, swampBotMod, 0.9); // Strong influence for fog color
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
