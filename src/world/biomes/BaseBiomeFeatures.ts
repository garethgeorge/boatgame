import * as THREE from 'three';
import { BiomeFeatures } from './BiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { LogSpawner } from '../../entities/spawners/LogSpawner';
import { RockSpawner } from '../../entities/spawners/RockSpawner';
import { BuoySpawner } from '../../entities/spawners/BuoySpawner';
import { MessageInABottleSpawner } from '../../entities/spawners/MessageInABottleSpawner';
import { PierSpawner } from '../../entities/spawners/PierSpawner';
import { Spawnable } from '../../entities/Spawnable'

export abstract class BaseBiomeFeatures implements BiomeFeatures {
    abstract id: BiomeType;

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

    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color } {
        const dayTop = new THREE.Color(0xA69AC2); // Pastel Lavender
        const dayBot = new THREE.Color(0xFFCBA4); // Pastel Peach
        const nightTop = new THREE.Color(0x1A1A3A); // Dark Slate Blue
        const nightBot = new THREE.Color(0x2D2D44); // Muted Dark Purple
        const sunsetTop = new THREE.Color(0x967BB6); // Muted Purple
        const sunsetBot = new THREE.Color(0xFF9966); // Soft Orange

        let currentTop: THREE.Color;
        let currentBot: THREE.Color;

        const transitionThreshold = 0.1;

        if (dayness > 0) {
            if (dayness < transitionThreshold) {
                const t = dayness / transitionThreshold;
                currentTop = sunsetTop.clone().lerp(dayTop, t);
                currentBot = sunsetBot.clone().lerp(dayBot, t);
            } else {
                currentTop = dayTop.clone();
                currentBot = dayBot.clone();
            }
        } else {
            if (dayness > -transitionThreshold) {
                const t = -dayness / transitionThreshold;
                currentTop = sunsetTop.clone().lerp(nightTop, t);
                currentBot = sunsetBot.clone().lerp(nightBot, t);
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

    public getBiomeLength(): number {
        return 1000;
    }

    public createLayout(length: number, zStart: number): any {
        return null;
    }
}
