import * as planck from 'planck';

/**
 * Result of any path strategy calculation.
 */
export type AnimalPathResult =
    | { kind: 'STEERING'; data: SteeringParams }
    | { kind: 'EXPLICIT'; data: ExplicitParams };

export interface SteeringParams {
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
        normal?: any;        // Surface normal alignment (THREE.Vector3)
    };

    // Dynamics (Water mainly)
    turningSpeed?: number;
    turningSmoothing?: number;
}

export interface ExplicitParams {
    position: any; // THREE.Vector3 - Absolute position
    rotation: any; // THREE.Euler/Quat - Absolute rotation
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
    abstract update(context: AnimalStrategyContext): AnimalPathResult;

    /**
     * If true the strategy is "finished" e.g because the animal is behind
     * the boat.
     */
    shouldAbort(context: AnimalStrategyContext): boolean {
        // Default: Don't abort
        return false;
    }
}
