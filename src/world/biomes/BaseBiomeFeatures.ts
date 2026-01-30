import * as THREE from 'three';
import { BiomeFeatures } from './BiomeFeatures';
import { Spawnable, SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations } from '../Decorations';
import { EntitySpawners } from '../../entities/spawners/EntitySpawners';

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

    abstract getGroundColor(): { r: number, g: number, b: number };

    getScreenTint(): { r: number, g: number, b: number } {
        return this.getGroundColor();
    }

    protected skyTopColors: number[] = [0x1A1A3A, 0x967BB6, 0x4488ff]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x2D2D44, 0xFF9966, 0xccddff]; // [Night, Sunset, Noon]

    protected interpolateSkyColors(dayness: number, colors: number[]): THREE.Color {

        if (dayness > 0) {
            // Lerp between Sunset (0) and Noon (1)
            const sunset = new THREE.Color(colors[1]);
            const noon = new THREE.Color(colors[2]);
            return sunset.lerp(noon, dayness);
        } else {
            // Lerp between Sunset (0) and Night (-1)
            // dayness is -1 to 0, so -dayness is 0 to 1
            const sunset = new THREE.Color(colors[1]);
            const night = new THREE.Color(colors[0]);
            return sunset.lerp(night, -dayness);
        }
    }

    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color } {
        return {
            top: this.interpolateSkyColors(dayness, this.skyTopColors),
            bottom: this.interpolateSkyColors(dayness, this.skyBottomColors)
        };
    }

    public getAmplitudeMultiplier(): number {
        return 1.0;
    }

    public getRiverWidthMultiplier(): number {
        return 1.0;
    }

    public getDecorationRules(): any[] | undefined {
        return undefined;
    }

    public setDecorationRules(rules: any[]): void {
        // Default no-op
    }

}
