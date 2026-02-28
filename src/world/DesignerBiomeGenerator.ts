import { BiomeFeatures } from './biomes/BiomeFeatures';
import { DesertBiomeFeatures } from './biomes/DesertBiomeFeatures';
import { ForestBiomeFeatures } from './biomes/ForestBiomeFeatures';
import { IceBiomeFeatures } from './biomes/IceBiomeFeatures';
import { SwampBiomeFeatures } from './biomes/SwampBiomeFeatures';
import { JurassicBiomeFeatures } from './biomes/JurassicBiomeFeatures';
import { TestBiomeFeatures } from './biomes/TestBiomeFeatures';
import { FracturedIceBiomeFeatures } from './biomes/FracturedIceBiomeFeatures';
import { HappyBiomeFeatures } from './biomes/HappyBiomeFeatures';
import { TropicalShorelineBiomeFeatures } from './biomes/TropicalShorelineBiomeFeatures';
import { FantasyBiomeFeatures } from './biomes/FantasyBiomeFeatures';
import { NullBiomeFeatures } from './biomes/NullBiomeFeatures';
import { BiomeType } from './biomes/BiomeType';
import { BiomeGenerator, BiomeInstance } from './BiomeManager';

const BIOME_CONSTRUCTORS: Record<BiomeType, new (index: number, z: number, direction: number) => BiomeFeatures> = {
    'desert': DesertBiomeFeatures,
    'forest': ForestBiomeFeatures,
    'ice': IceBiomeFeatures,
    'swamp': SwampBiomeFeatures,
    'jurassic': JurassicBiomeFeatures,
    'test': TestBiomeFeatures,
    'fractured_ice': FracturedIceBiomeFeatures,
    'happy': HappyBiomeFeatures,
    'tropical_shoreline': TropicalShorelineBiomeFeatures,
    'fantasy': FantasyBiomeFeatures,
    'null': NullBiomeFeatures
};

export class DesignerBiomeGenerator implements BiomeGenerator {
    constructor(
        private targetBiome: BiomeType
    ) { }

    public putBack(type: BiomeType): void { }

    public next(z: number, direction: number): BiomeInstance {
        // In designer mode, the target biome is at z=0, everything else is null
        const type = (z === 0 && direction < 0) ? this.targetBiome : 'null';

        const features = new BIOME_CONSTRUCTORS[type](0, z, direction);
        const range = features.getRange();

        return {
            type, zMin: range.zMin, zMax: range.zMax, features
        };
    }
}
