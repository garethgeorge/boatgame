import * as planck from 'planck';
import * as THREE from 'three';

// Any animal must implement this interface to get behavior
export interface AnyAnimal {
    // the physics body is directly read and updated by the behavior
    // it defines the position, orientation, velocity, etc.
    // the collision mask can also be modified by the behavior
    getPhysicsBody(): planck.Body | null;
}

// Behavior callbacks for animal on shore
export interface AttackAnimalShore extends AnyAnimal {
    // set the height and normal of the animal when it is on land
    setLandPosition(height: number, normal: THREE.Vector3): void;

    // called when animal starts entering water e.g. to switch animations
    didStartEnteringWater?(): void;
    didCompleteEnteringWater?(speed: number): void;
}

// Behavior callbacks for animal in water
export interface AttackAnimalWater extends AnyAnimal {
}

export type AttackAnimal = AttackAnimalShore & AttackAnimalWater;

