import * as THREE from 'three';
import { TerrainChunk } from '../TerrainChunk';
import { BiomeDecorationHelper } from './BiomeDecorationHelper';
import { EntityManager } from '../../core/EntityManager';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { RiverSystem } from '../RiverSystem';

export interface PopulationContext {
    riverSystem: RiverSystem;

    // Entity management
    entityManager: EntityManager;
    physicsEngine: PhysicsEngine;

    // The chunk we are decorating
    chunk: TerrainChunk;

    // Helper for biome decorations
    decoHelper: BiomeDecorationHelper;

    // Output for geometries that are grouped by material. These can be
    // merged for better performance. 
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>;
    // Output for instanced data. Map<Geometry, Map<Material, { matrix: THREE.Matrix4, color?: THREE.Color }[]>>
    instancedData: Map<THREE.BufferGeometry, Map<THREE.Material, { matrix: THREE.Matrix4, color?: THREE.Color }[]>>;
    // Output for geometries that can't be grouped by material.
    geometryGroup: THREE.Group;

    // Statistics for decorations placed in this context
    stats: Map<string, number>;
}
