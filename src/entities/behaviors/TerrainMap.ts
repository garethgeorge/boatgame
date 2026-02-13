import * as THREE from 'three';

export interface TerrainMap {
    /**
     * Sample the terrain at the local (x,z) coordinate. 
     * Water height is supplied as a reference for water-based height calculations.
     */
    sample(x: number, z: number, waterHeight: number): { y: number, normal: THREE.Vector3 };
}
