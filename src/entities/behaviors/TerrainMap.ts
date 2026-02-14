import * as THREE from 'three';

export type Zone = 'land' | 'water' | 'margin';

export interface TerrainMap {
    /**
     * Sample the terrain at the local (x,z) coordinate. 
     * Water height is supplied as a reference for water-based height calculations.
     * Margin defines the distance over which to interpolate height.
     */
    sample(x: number, z: number, waterHeight: number, margin: number): { y: number, normal: THREE.Vector3, zone: Zone };
}
