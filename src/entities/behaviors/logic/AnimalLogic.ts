import * as planck from 'planck';
import { AnimalStrategyContext } from './AnimalPathStrategies';

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
    physicsBody: planck.Body;
}

/**
 * Standardized result from any animal logic calculation.
 */
export interface AnimalLogicPathResult {
    // Parameters for all types of locomotion
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;

    // Parameters for flight locomotion
    desiredHeight?: number;      // If present, engine engages flight dynamics

    // Parameters for water locomotion
    turningSpeed?: number;
    turningSmoothing?: number;

    // Specifies the current phase of the logic
    animationState?: string;

    // True if the logic is complete
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

    isPreparing?(): boolean;
}
