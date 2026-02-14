import * as planck from 'planck';
import * as THREE from 'three';
import { AnimalLogic, AnimalLogicPhase } from './logic/AnimalLogic';
import { TerrainSlot } from '../../world/TerrainSlotMap';
import { TerrainMap, Zone } from './TerrainMap';

/**
 * LOGIC_STARTING - about to start a logic stage
 * LOGIC_TICK - sent while logic is running
 * LOGIC_FINISHED - all logic is complete
 */
export type AnimalBehaviorEvent =
    { type: 'LOGIC_STARTING', logic: AnimalLogic, logicPhase: AnimalLogicPhase }
    | { type: 'LOGIC_TICK', dt: number, logic: AnimalLogic, logicPhase: AnimalLogicPhase }
    | { type: 'ZONE_CHANGED', zone: Zone }
    | { type: 'LOGIC_FINISHED' }

// Any animal must implement this interface to get behavior
export interface AnyAnimal {
    /**
     * The slot (e.g. a perch) owned by the animal.
     */
    currentSlot: TerrainSlot | null;

    /**
     * Note that these functions may return the input if no conversion
     * is needed.
     */
    worldToLocalPos(world: THREE.Vector3): void;
    localToWorldPos(world: THREE.Vector3): void;

    /**
     * Get the position of the animal in its parent frame.
     */
    localPos(): THREE.Vector3;

    /**
     * Note that this is the physics coordinate system angle, -ve of
     * graphics.
     */
    localAngle(): number;

    /**
     * Get the terrain map for the animal. 
     */
    getTerrainMap(): TerrainMap;

    /**
     * The physics body is directly read and updated by the behavior.
     * It defines the position, orientation, velocity, etc. Those
     * values are directly set for dynamic (physics based) motion and
     * the physics position is copied to the mesh. Kinematic motion updates
     * the mesh instead and the mesh position is copied to physics.
     * The collision mask can also be modified by the behavior.
     */
    getPhysicsBody(): planck.Body | null;

    /**
     * Get the mesh for the animal. Kinematic motion directly updates the
     * mesh.
     */
    getMesh(): THREE.Object3D | null;

    /**
     * Applies only to dynamic motion (i.e. motion driven by physiscs)
     * set the height and normal as those are not controlled by physics
     */
    setDynamicPosition(height: number, normal: THREE.Vector3): void;

    /**
     * Handle generic behavior events
     */
    handleBehaviorEvent?(event: AnimalBehaviorEvent): void;
}
