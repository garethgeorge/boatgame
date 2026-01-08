import * as planck from 'planck';

/**
 * Shared context passed to animal logic modules every frame.
 */
export interface AnimalLogicContext {
    dt: number;
    originPos: planck.Vec2;
    snoutPos: planck.Vec2;
    physicsBody: planck.Body;
    targetBody: planck.Body;
    aggressiveness: number;
    bottles: number;
}

/**
 * Standard result from an animal logic calculation.
 */
export interface AnimalLogicPathResult {
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;
    turningSpeed: number;
    turningSmoothing: number;
    animationState?: 'IDLE' | 'ATTACKING' | 'PREPARING' | 'FLEEING';
}

/**
 * Unified interface for all water-based animal behavior logic.
 */
export interface AnimalLogic {
    readonly name: string;

    /**
     * Per-frame state update (e.g. internal timers, target selection).
     */
    update(context: AnimalLogicContext): void;

    /**
     * Calculate movement target and speed.
     */
    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult;

    /**
     * State transition: Should we switch from IDLE to ACTIVE?
     */
    shouldActivate(context: AnimalLogicContext): boolean;

    /**
     * State transition: Should we switch from ACTIVE back to IDLE?
     */
    shouldDeactivate(context: AnimalLogicContext): boolean;

    /**
     * True if the animal is in a preparation state (stationary but facing target).
     */
    isPreparing(): boolean;
}
