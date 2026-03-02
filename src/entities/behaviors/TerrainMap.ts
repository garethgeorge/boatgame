import * as THREE from 'three';
import { TerrainSlotMap } from '../../world/TerrainSlotMap';

export type Zone = 'land' | 'water' | 'margin';

export interface SurfaceInfo {
    y: number;                // Terrain height
    normal: THREE.Vector3;    // Surface slope
    zone: Zone;
}

export interface ShoreInfo {
    position: THREE.Vector2;
    /** 
     * Tangent to the shore. By convention, this is the normal vector rotated 90 degrees clockwise.
     * i.e., { x: normal.y, y: -normal.x } (since Vector2 uses x,y for the X-Z plane). 
     * It has NO implicit relationship to the water flow direction.
     */
    direction: THREE.Vector2;
    /** Vector pointing directly away from the shore (into the water). */
    normal: THREE.Vector2;
    distance: number;         // Distance from the query origin to this shoreline point
}

export enum EdgeType {
    SHORE = 1 << 0,
    DYNAMIC_FEATURE = 1 << 1,
    ANY = SHORE | DYNAMIC_FEATURE
}

export interface TerrainMap {
    /** 
     * Unified spatial lookup for height and normal vector.
     */
    getSurfaceInfo(x: number, z: number): SurfaceInfo;

    /**
     * Get the zone containing the circle of radius at (x,z). If the circle intersects
     * two zones the zone is 'margin' and t specifies how far parametrically the
     * center is into the zone. -1 is entirely on land, 0 is half land/water, 1
     * entirely in water. 
     */
    getZone(x: number, z: number, radius: number): { zone: Zone, t: number };

    /**
     * Finds the nearest transition point between land and water.
     * Useful for tracking edges without knowing if it's a "left" or "right" bank.
     */
    getNearestEdge(x: number, z: number, edgeMask?: EdgeType): ShoreInfo;

    /**
     * Casts a ray from the start position in the given direction and returns the 
     * edge information at the intersection point, or null if it does not intersect.
     */
    getDirectionEdge(startX: number, startZ: number, dirX: number, dirZ: number, edgeMask?: EdgeType): ShoreInfo | null;

    /**
     * Returns the water flow direction vector of the nearest water body.
     * Useful for: Swimming with/against the current, or orienting downstream.
     */
    getNearestWaterFlow(x: number, z: number): THREE.Vector2;

    /**
     * Get the slot map associated with this terrain.
     * Used for finding landing spots like branches or rocks.
     */
    getTerrainSlots(): TerrainSlotMap;

    /**
     * Finds the nearest water channel X-bounds to the left (-X) and right (+X) of a given point.
     * This defines the navigable width of the water body nearest to that location.
     */
    getNearestWaterChannel(x: number, z: number): { minX: number, maxX: number };
}
