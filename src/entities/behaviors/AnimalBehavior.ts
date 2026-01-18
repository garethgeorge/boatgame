import * as planck from 'planck';
import * as THREE from 'three';
import { AnimalLogic, AnimalLogicPhase } from './logic/AnimalLogic';

/**
 * LOGIC_STARTING - about to start a logic stage
 * LOGIC_TICK - sent while logic is running
 * LOGIC_FINISHED - all logic is complete
 */
export type AnimalBehaviorEvent =
    { type: 'LOGIC_STARTING', logic: AnimalLogic, logicPhase: AnimalLogicPhase }
    | { type: 'LOGIC_TICK', dt: number, logic: AnimalLogic, logicPhase: AnimalLogicPhase }
    | { type: 'LOGIC_FINISHED' }

// Any animal must implement this interface to get behavior
export interface AnyAnimal {
    // the physics body is directly read and updated by the behavior
    // it defines the position, orientation, velocity, etc.
    // the collision mask can also be modified by the behavior
    getPhysicsBody(): planck.Body | null;

    // get the height of the animal with water level being 0
    getHeight(): number;

    // explicitly set the height and normal of the animal
    setExplictPosition?(height: number, normal: THREE.Vector3): void;

    // Handle generic behavior events
    handleBehaviorEvent?(event: AnimalBehaviorEvent): void;
}
