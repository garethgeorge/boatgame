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
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;

    // Optional Flight Parameters
    desiredHeight?: number;      // If present, engine engages flight dynamics

    // Optional Locomotion Tuning
    turningSpeed?: number;
    turningSmoothing?: number;

    // Feedback
    animationState?: string;
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
