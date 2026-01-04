import * as planck from 'planck';
import * as THREE from 'three';

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

// Behavior callbacks for animal entering water
export interface AnimalEnteringWater extends AnyAnimal {
    enteringWaterApplyHeightCurve?(height: number, progress: number): number;
    enteringWaterDidComplete?(speed: number): void;
}

// Behavior callbacks for animal walking on shore
export interface AnimalShoreWalk extends AnyAnimal {
    shoreWalkDidComplete?(): void;
}

// Behavior callbacks for animal in water
export interface AnimalWaterAttack extends AnyAnimal {
    waterAttackUpdateIdle?(dt: number): void;
    waterAttackUpdatePreparing?(dt: number): void;
    waterAttackUpdateAttacking?(dt: number): void;
}

// Behavior callbacks for animal in flight
export interface AnimalFlight extends AnyAnimal {
    flightDidComplete?(): void;
}

