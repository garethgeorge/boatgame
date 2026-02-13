import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from '../../AnimalBehavior';

/**
 * Supported locomotion physics models.
 */
export type LocomotionType = 'WATER' | 'LAND' | 'FLIGHT';

/**
 * Result of any path strategy calculation. The interpretation of these parameters
 * depends on the active LocomotionType. At its most basic the steering says to
 * move toward a target point at a target speed. This doesn't mean instantly change
 * to head in the target direction, rather the current motion should be adjusted
 * toward the target.
 */
export interface AnimalSteering {
    /** 
     * Interpretation of these parameters depends on the active LocomotionType.
     */
    locomotionType: LocomotionType;

    /** 
     * 2D Target position on the XZ plane.
     * - WATER: Used for both steering direction and target rotation.
     * - LAND: Targets kinematic movement; also used for rotation.
     * - FLIGHT: Defines the horizontal flight path and informs banking/steering.
     */
    target: planck.Vec2;

    /**
     * Vertical Target (Y axis).
     * - FLIGHT only: The target altitude. Animal will climb/descend smoothly toward this value.
     * Land motion uses terrain height, water motion uses animal water height.
     */
    height?: number;

    /** 
     * Desired movement speed.
     * - WATER: Adjusted by alignment and proximity to target.
     * - LAND/FLIGHT: Sets the magnitude of kinematic velocity.
     */
    speed: number;

    /** 
     * Rotation speed limits.
     * - WATER/FLIGHT: Controls the maximum angular change per second.
     * - LAND: Controls the maximum angular change per second for kinematic rotation.
     */
    turningSpeed?: number;

    /** 
     * Responsiveness of rotation.
     * - WATER: Controls the interpolation speed of angular velocity.
     */
    turningSmoothing?: number;

    /**
     * Whether banking (tilting during turns) is enabled.
     * - FLIGHT: If false, the animal will not bank during turns. Defaults to true.
     */
    bankingEnabled?: boolean;
}

/**
 * Shared context for animal path strategies.
 */
export interface AnimalStrategyContext {
    dt: number;
    animal: AnyAnimal;
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
