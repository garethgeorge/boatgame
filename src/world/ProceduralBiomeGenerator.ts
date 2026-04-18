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

export class ProceduralBiomeGenerator implements BiomeGenerator {
    private static readonly MAX_DECK_SIZE = 20;

    private deck: BiomeType[] = [];
    private index: Map<BiomeType, number> = new Map<BiomeType, number>();

    public putBack(type: BiomeType): void {
        if (this.deck.length < ProceduralBiomeGenerator.MAX_DECK_SIZE) {
            this.deck.push(type);
            const index = this.index.get(type) ?? 1;
            this.index.set(type, Math.max(0, index - 1));
        }
    }

    public next(z: number, direction: number): BiomeInstance {
        const type = this.drawFromDeck();
        const index = this.index.get(type) ?? 0;
        this.index.set(type, index + 1);

        const features = new BIOME_CONSTRUCTORS[type](index, z, direction);
        const range = features.getRange();

        return {
            type, zMin: range.zMin, zMax: range.zMax, features
        };
    }

    private drawFromDeck(): BiomeType {
        if (this.deck.length === 0) {
            const otherTypes: BiomeType[] = ['desert', 'forest', 'ice', 'swamp', 'jurassic', 'tropical_shoreline', 'fantasy', 'fractured_ice'];
            const shuffled = [...otherTypes].sort(() => Math.random() - 0.5);

            for (const type of shuffled) {
                this.deck.push(type, 'happy');
            }
        }
        return this.deck.pop()!;
    }
}
