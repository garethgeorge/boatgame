import * as planck from 'planck';
import * as THREE from 'three';
import { AnimalStrategyContext } from './AnimalPathStrategy';

/**
 * Supported locomotion physics models.
 */
export type LocomotionType = 'WATER' | 'LAND' | 'FLIGHT';

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
    // Basic locomotion targets
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;

    // The physics model to use for this frame
    locomotionType: LocomotionType;

    // --- LAND Locomotion Properties ---
    // Specifically for use when locomotionType is 'LAND'
    explicitHeight?: number;
    explicitNormal?: THREE.Vector3;
    desiredAngle?: number;

    // --- FLIGHT Locomotion Properties ---
    // Specifically for use when locomotionType is 'FLIGHT'
    desiredHeight?: number;

    // --- WATER Locomotion Properties ---
    // Specifically for use when locomotionType is 'WATER'
    turningSpeed?: number;
    turningSmoothing?: number;

    // Specifies the current visual phase of the logic
    animationState?: string;

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

    update(context: AnimalLogicContext): void;
    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult;

    shouldActivate(context: AnimalLogicContext): boolean;
    shouldDeactivate(context: AnimalLogicContext): boolean;

    /**
     * Optional: Get the estimated duration of the current logic block.
     * Useful for syncing animations or external logic.
     */
    getEstimatedDuration?(context: AnimalLogicContext): number | undefined;

    isPreparing?(): boolean;
}
