import * as planck from 'planck';
import * as THREE from 'three';

/**
 * Result of any path strategy calculation.
 */
export interface AnimalSteering {
    // 2D Target (XZ plane)
    target: planck.Vec2;
    speed: number;

    // Optional Vertical Target (Y axis)
    // If undefined -> defaults to Ground/Water level
    height?: number;

    // Optional Orientation Target
    // If undefined -> faces movement direction
    facing?: {
        angle?: number;      // Absolute Y-axis rotation
        normal?: THREE.Vector3;        // Surface normal alignment (THREE.Vector3)
    };

    // Dynamics (Water mainly)
    turningSpeed?: number;
    turningSmoothing?: number;
}

/**
 * Shared context for animal path strategies.
 */
export interface AnimalStrategyContext {
    dt: number;
    originPos: planck.Vec2;
    snoutPos: planck.Vec2;
    currentHeight: number;
    physicsBody: planck.Body;
    targetBody: planck.Body;
    aggressiveness: number;
    bottles: number;
}

/**
 * Universal base class for animal path strategies.
 * Provides default implementations for optional behavioral methods.
 */
export abstract class AnimalPathStrategy {
    abstract readonly name: string;

    /** 
     * Calculate the point that the animal should steer toward.
     */
    abstract update(context: AnimalStrategyContext): AnimalSteering;
}
