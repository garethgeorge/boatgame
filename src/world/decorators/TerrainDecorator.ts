import * as THREE from 'three';
import { TerrainChunk } from '../TerrainChunk';
import { RiverSystem } from '../RiverSystem';
import { TerrainChunkGeometry } from '../TerrainChunkGeometry';

export interface DecorationContext {
    chunk: TerrainChunk;
    riverSystem: RiverSystem;
    geometry: TerrainChunkGeometry;
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>;
    group: THREE.Group;
    zOffset: number;
}

export interface TerrainDecorator {
    decorate(context: DecorationContext): Promise<void>;
}
