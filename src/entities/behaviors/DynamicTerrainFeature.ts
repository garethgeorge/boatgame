import * as THREE from 'three';
import * as planck from 'planck';

export interface DynamicTerrainFeature {
    /** 
     * Determines if a global world coordinate is strictly inside the precise geometry.
     * Box2D uses convex hulls, but visual/logical geometry might be concave or jagged.
     */
    containsGlobalPoint(globalX: number, globalZ: number): boolean;

    /** Gets the derived surface Y-coordinate at a point inside the feature */
    getSurfaceHeight(globalX: number, globalZ: number): number;

    /** Gets the normal vector of the surface at the point */
    getSurfaceNormal(globalX: number, globalZ: number): THREE.Vector3;

    /** 
     * Calculates the exact distance from a global point to the nearest precise edge,
     * along with the nearest global point and normal.
     * Distance should be negative if inside the feature.
     */
    getExactDistanceToEdge(globalX: number, globalZ: number): { distance: number, position: THREE.Vector2, normal: THREE.Vector2 };

    /**
     * Finds the exact intersection of a ray against the precise geometry.
     * Returns the closest T value, or null if it misses.
     */
    rayCastExactEdge(startX: number, startZ: number, dirX: number, dirZ: number): { t: number, intersectX: number, intersectZ: number, normal: THREE.Vector2 } | null;
}
