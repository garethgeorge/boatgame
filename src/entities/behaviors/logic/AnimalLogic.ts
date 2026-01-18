import * as planck from 'planck';
import * as THREE from 'three';
import { AnimalSteering } from './AnimalPathStrategy';
import { AnimalBehaviorEvent } from '../AnimalBehavior';
import { AnimalStrategyContext } from './AnimalPathStrategy';

/**
 * Supported locomotion physics models.
 */
export type LocomotionType = 'WATER' | 'LAND' | 'FLIGHT';

/**
 * Phases that any animal logic can be in.
 */
export enum AnimalLogicPhase {
    IDLE = 'IDLE',
    PREPARING = 'PREPARING',
    ATTACKING = 'ATTACKING',
    FLEEING = 'FLEEING',
    WALKING = 'WALKING',
    FLYING = 'FLYING'
}

/**
 * Configuration for any animal behavioral logic.
 */
export interface AnimalLogicConfig {
    name: string;
    params?: Record<string, any>;
}

/**
 * Shared context passed to ALL animal logic modules every frame.
 */
export interface AnimalLogicContext extends AnimalStrategyContext {
}

/**
 * Standardized result from any animal logic calculation.
 */
export interface AnimalLogicPathResult {
    // Composition: Holds the physical path result (Steering or Explicit)
    path: AnimalSteering;

    // The physics model to use for this frame
    locomotionType: LocomotionType;

    // Specifies the current phase of the logic if it has them
    logicPhase?: AnimalLogicPhase;

    // --- Logic Chaining ---
    // Transition to a new logic if specified
    nextLogicConfig?: AnimalLogicConfig;

    // True if the current behavioral sequence is complete
    isFinished?: boolean;
}

/**
 * Unified interface for any animal behavioral logic.
 */
export interface AnimalLogic {
    readonly name: string;

    /**
     * Is the logic applicable?
     */
    shouldActivate(context: AnimalLogicContext): boolean;

    /**
     * Start this logic, do any initialization
     */
    activate(context: AnimalLogicContext): void;

    /**
     * Update logic and return new animal path to apply
     */
    update(context: AnimalLogicContext): AnimalLogicPathResult;

    /**
     * Optional: Get the estimated duration of the current logic block.
     * Useful for syncing animations or external logic.
     */
    getEstimatedDuration?(context: AnimalLogicContext): number | undefined;
}
