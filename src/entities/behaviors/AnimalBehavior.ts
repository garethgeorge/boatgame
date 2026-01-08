import * as planck from 'planck';
import * as THREE from 'three';

/**
 * IDLE_TICK - called while behavior is not running logic
 * PREPARING_TICK - logic active and in a preparing state
 * ACTIVE_TICK - logic active
 * LOGIC_STARTING - about to start a logic stage
 * LOGIC_COMPLETED - finished a logic stage
 * COMPLETED - returned to idle because logic deactivated or finished
 */
export type AnimalBehaviorEvent =
    | { type: 'IDLE_TICK', dt: number }
    | { type: 'PREPARING_TICK', dt: number }
    | { type: 'ACTIVE_TICK', dt: number, animationState?: string }
    | { type: 'LOGIC_STARTING', logicName: string, duration?: number }
    | { type: 'LOGIC_COMPLETED', logicName: string }
    | { type: 'COMPLETED' };

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

// Behavior callbacks for animal in idle shore state
export interface AnimalShoreIdle extends AnyAnimal {
    // Called at random to give the animal a chance to switch to another
    //  behavior e.g. from standing still to walking away or dancing
    shoreIdleMaybeSwitchBehavior?(): void;

    // Called when the idle behavior determines it's time to notice the boat
    // Returns true if the animal started a new behavior, false otherwise
    shoreIdleMaybeNoticeBoat?(): boolean;
}

// Behavior callbacks for animal walking on shore
export interface AnimalShoreWalk extends AnyAnimal {
    shoreWalkDidComplete?(): void;
}


