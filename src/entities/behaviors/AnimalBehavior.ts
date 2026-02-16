import * as planck from 'planck';
import * as THREE from 'three';
import { AnimalLogic, AnimalLogicPhase } from './logic/AnimalLogic';
import { TerrainSlot } from '../../world/TerrainSlotMap';
import { TerrainMap, Zone } from './TerrainMap';

/**
 * Logic events are triggered during updateLogic()
 * LOGIC_STARTING - about to start a logic stage
 * LOGIC_TICK - sent while logic is running
 * LOGIC_FINISHED - all logic is complete
 * 
 * Events triggered during updateSceneGraph()
 * ZONE_CHANGED
 */
export type AnimalBehaviorEvent =
    { type: 'LOGIC_STARTING', logic: AnimalLogic, logicPhase: AnimalLogicPhase }
    | { type: 'LOGIC_TICK', dt: number, logic: AnimalLogic, logicPhase: AnimalLogicPhase }
    | { type: 'LOGIC_FINISHED' }
    | { type: 'ZONE_CHANGED', zone: Zone }

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
     * Handle generic behavior events
     */
    handleBehaviorEvent?(event: AnimalBehaviorEvent): void;
}
