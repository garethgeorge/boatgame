import * as THREE from 'three';
import { TerrainChunk } from '../TerrainChunk';
import { RiverSystem } from '../RiverSystem';
import { TerrainChunkGeometry } from '../TerrainChunkGeometry';

export interface DecorationContext {
    // The chunk we are decorating
    chunk: TerrainChunk;
    // The river system
    riverSystem: RiverSystem;
    // The chunk geometry
    chunkGeometry: TerrainChunkGeometry;
    // Output for geometries that are grouped by material. These can be
    // merged for better performance. 
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>;
    // Output for geometries that can't be grouped by material.
    geometryGroup: THREE.Group;
    // Output for animation mixers
    animationMixers: THREE.AnimationMixer[];
    // The z offset of the chunk
    zOffset: number;
}

export interface TerrainDecorator {
    decorate(context: DecorationContext): Promise<void>;
}
