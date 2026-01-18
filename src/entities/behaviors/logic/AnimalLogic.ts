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
    NONE = 'NONE',
    IDLE_SHORE = 'IDLE_SHORE',
    IDLE_WATER = 'IDLE_WATER',
    ENTERING_WATER = 'ENTERING_WATER',
    PREPARING_ATTACK = 'PREPARING_ATTACK',
    ATTACKING = 'ATTACKING',
    SWIMING_AWAY = 'SWIMING_AWAY',
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
     * Start this logic, do any initialization
     */
    activate(context: AnimalLogicContext): void;

    /**
     * Update logic and return new animal path to apply
     */
    update(context: AnimalLogicContext): AnimalLogicPathResult;

    /**
     * Get the current logic phase. Only valid after logic is activated.
     */
    getPhase(): AnimalLogicPhase;

    /**
     * Optional: Get the estimated duration of the current phase. Only
     * valid after logic is activated. Useful for syncing animations.
     */
    getDuration?(): number | undefined;
}
