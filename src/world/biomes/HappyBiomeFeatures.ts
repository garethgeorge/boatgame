import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { BoatPathLayout } from './BoatPathLayoutStrategy';

/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Currently empty of decorations and obstacles.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';

    getGroundColor(): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        // Use a lighter, more neutral tint for the happy biome to avoid washing out the sky
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    protected skyTopColors: number[] = [0x303948, 0xf6b581, 0x01cad1]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x5b6831, 0xf7efbc, 0xb0ece6]; // [Night, Sunset, Noon]

    public getBiomeLength(): number {
        return 1500;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout<any> {
        // Return an empty layout for now
        return {
            path: [],
            sections: [],
            waterAnimals: []
        } as any;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        // Empty for now as requested
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        // Empty for now as requested
    }
}
