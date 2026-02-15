import * as THREE from 'three';

export type Zone = 'land' | 'water' | 'margin';

export interface TerrainMap {
    /**
     * Sample the terrain at the local (x,z) coordinate. 
     */
    sample(x: number, z: number): { y: number, normal: THREE.Vector3 };

    /**
     * Get the zone at the local (x,z) coordinate.
     */
    zone(x: number, z: number, margin: number, width: number): { zone: Zone, t: number };
}
