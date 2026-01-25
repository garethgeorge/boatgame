import * as THREE from 'three';
import { TerrainChunk } from '../TerrainChunk';
import { RiverSystem } from '../RiverSystem';
import { BiomeDecorationHelper } from '../biomes/BiomeDecorationHelper';

export interface DecorationContext {
    // The chunk we are decorating
    chunk: TerrainChunk;

    // The start Z of the current biome
    biomeZMin: number;
    // The end Z of the current biome
    biomeZMax: number;
    // The biome layout
    biomeLayout?: any;

    // Helper for biome decorations
    decoHelper: BiomeDecorationHelper;

    // Output for geometries that are grouped by material. These can be
    // merged for better performance. 
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>;
    // Output for instanced data. Map<Geometry, Map<Material, { matrix: THREE.Matrix4, color?: THREE.Color }[]>>
    instancedData: Map<THREE.BufferGeometry, Map<THREE.Material, { matrix: THREE.Matrix4, color?: THREE.Color }[]>>;
    // Output for geometries that can't be grouped by material.
    geometryGroup: THREE.Group;
}
