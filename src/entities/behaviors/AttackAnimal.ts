import * as planck from 'planck';
import * as THREE from 'three';

// Any animal must implement this interface to get behavior
export interface AnyAnimal {
    // the physics body is directly read and updated by the behavior
    // it defines the position, orientation, velocity, etc.
    // the collision mask can also be modified by the behavior
    getPhysicsBody(): planck.Body | null;
}

// Behavior callbacks for animal in idle shore state
export interface AttackAnimalShoreIdle extends AnyAnimal {
    // Called when the idle behavior determines it's time to enter water
    // Returns true if the animal started entering water, false otherwise
    shouldStartEnteringWater(): boolean;
}

// Behavior callbacks for animal entering water
export interface AttackAnimalEnteringWater extends AnyAnimal {
    // set the height and normal of the animal when it is on land
    // progress: 0 (start of entry) to 1 (fully in water)
    setLandPosition(height: number, normal: THREE.Vector3, progress: number): void;

    didCompleteEnteringWater?(speed: number): void;
}

// Behavior callbacks for animal in water
export interface AttackAnimalWater extends AnyAnimal {
}

