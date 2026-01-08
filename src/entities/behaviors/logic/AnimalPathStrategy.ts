import * as planck from 'planck';

/**
 * Result of any path strategy calculation.
 */
export interface AnimalPathResult {
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;
    desiredHeight?: number;
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

    /** Update strategy state prior to calculating path. */
    update(context: AnimalStrategyContext): void {
        // Default: No-op
    }

    /** Calculate the point that the animal should steer toward. */
    abstract calculatePath(context: AnimalStrategyContext): AnimalPathResult;

    /** Should this strategy be aborted because it no longer applies? */
    shouldAbort(context: AnimalStrategyContext): boolean {
        // Default: Don't abort
        return false;
    }
}
