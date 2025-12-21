import { Color3, Scalar } from '@babylonjs/core';
import { BiomeFeatures } from './BiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { BiomeDecorationHelper } from './BiomeDecorationHelper';
// import { Decorations } from '../Decorations';
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

    getFogDensity(): number {
        return 0.0;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 100, far: 800 };
    }

    abstract getGroundColor(): { r: number, g: number, b: number };

    getScreenTint(): { r: number, g: number, b: number } {
        return this.getGroundColor();
    }

    getSkyColors(dayness: number): { top: Color3, bottom: Color3 } {
        const dayTop = Color3.FromHexString("#A69AC2"); // Pastel Lavender
        const dayBot = Color3.FromHexString("#FFCBA4"); // Pastel Peach
        const nightTop = Color3.FromHexString("#1A1A3A"); // Dark Slate Blue
        const nightBot = Color3.FromHexString("#2D2D44"); // Muted Dark Purple
        const sunsetTop = Color3.FromHexString("#967BB6"); // Muted Purple
        const sunsetBot = Color3.FromHexString("#FF9966"); // Soft Orange

        let currentTop: Color3;
        let currentBot: Color3;

        const transitionThreshold = 0.1;

        if (dayness > 0) {
            if (dayness < transitionThreshold) {
                const t = dayness / transitionThreshold;
                currentTop = Color3.Lerp(sunsetTop, dayTop, t);
                currentBot = Color3.Lerp(sunsetBot, dayBot, t);
            } else {
                currentTop = dayTop.clone();
                currentBot = dayBot.clone();
            }
        } else {
            if (dayness > -transitionThreshold) {
                const t = -dayness / transitionThreshold;
                currentTop = Color3.Lerp(sunsetTop, nightTop, t);
                currentBot = Color3.Lerp(sunsetBot, nightBot, t);
            } else {
                currentTop = nightTop.clone();
                currentBot = nightBot.clone();
            }
        }

        return { top: currentTop, bottom: currentBot };
    }

    public getAmplitudeMultiplier(): number {
        return 1.0;
    }

    public getRiverWidthMultiplier(): number {
        return 1.0;
    }
}
