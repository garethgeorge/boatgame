import * as THREE from 'three';
import { TerrainChunk } from '../TerrainChunk';
import { RiverSystem } from '../RiverSystem';
import { TerrainGeometry } from '../TerrainGeometry';

import { BiomeDecorationHelper } from '../biomes/BiomeDecorationHelper';

export interface DecorationContext {
    // The chunk we are decorating
    chunk: TerrainChunk;
    // The river system
    riverSystem: RiverSystem;
    // Output for geometries that are grouped by material. These can be
    // merged for better performance. 
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>;
    // Output for instanced data. Map<Geometry, Map<Material, Matrices>>
    instancedData: Map<THREE.BufferGeometry, Map<THREE.Material, THREE.Matrix4[]>>;
    // Output for geometries that can't be grouped by material.
    geometryGroup: THREE.Group;
    // Output for animation mixers
    animationMixers: THREE.AnimationMixer[];
    // The z offset of the chunk
    zOffset: number;
    // The start Z of the current biome
    biomeZStart: number;
    // The end Z of the current biome
    biomeZEnd: number;
    // Helper for biome decorations
    decoHelper: BiomeDecorationHelper;
}

export interface TerrainDecorator {
    decorate(context: DecorationContext): Promise<void>;
}
