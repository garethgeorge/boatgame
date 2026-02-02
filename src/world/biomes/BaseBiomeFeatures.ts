import { BiomeFeatures, SkyBiome } from './BiomeFeatures';
import { Spawnable, SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { DecorationConfig } from '../decorators/TerrainDecorator';
import { MathUtils } from '../../core/MathUtils';

export abstract class BaseBiomeFeatures implements BiomeFeatures {
    abstract id: BiomeType;

    protected index: number = 0;
    protected zMin: number = 0;
    protected zMax: number = 0;

    /**
     * If index is < 0 the z value is the end of the biome if > 0 it is the start
     */
    constructor(index: number, z: number, length: number, direction: number) {
        this.index = index;
        if (direction < 0) {
            this.zMax = z;
            this.zMin = z - length;
        } else {
            this.zMin = z;
            this.zMax = z + length;
        }
    }

    getRange(): { zMin: number, zMax: number } {
        return { zMin: this.zMin, zMax: this.zMax };
    }

    abstract decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown>;
    abstract spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown>;

    protected *spawnObstacles(spawner: Spawnable, context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const count = spawner.getSpawnCount(context, difficulty, zStart, zEnd);
        return yield* spawner.spawn(context, count, zStart, zEnd, [this.zMin, this.zMax]);
    }

    getFogDensity(): number {
        return 0.0;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 100, far: 800 };
    }

    abstract getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number };

    abstract getScreenTint(): { r: number, g: number, b: number };

    public getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x4488ff, bottom: 0xccddff },
            sunset: { top: 0x967BB6, bottom: 0xFF9966 },
            night: { top: 0x1A1A3A, bottom: 0x2D2D44 },
            haze: 0.5
        };
    }

    public getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        // Apply Bank Taper: Force land height to 0 at the river edge
        // Smoothly ramp up over 15 units
        const bankTaper = MathUtils.smoothstep(0, 15, distFromBank);
        return bankTaper;
    }

    public getRiverWidthMultiplier(): number {
        return 1.0;
    }

    public getDecorationConfig(): DecorationConfig | undefined {
        return undefined;
    }
}
