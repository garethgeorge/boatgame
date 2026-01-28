import * as planck from 'planck';
import * as THREE from 'three';
import { AnimalSteering } from './strategy/AnimalPathStrategy';
import { AnimalBehaviorEvent } from '../AnimalBehavior';
import { AnimalStrategyContext } from './strategy/AnimalPathStrategy';

/**
 * Supported locomotion physics models.
 */
export type LocomotionType = 'WATER' | 'LAND' | 'FLIGHT';

/**
 * Phases that any animal logic can be in.
 */
export enum AnimalLogicPhase {
    NONE = 'NONE',
    // For WaitOnShoreLogic and DelayLogic
    IDLE_SHORE = 'IDLE_SHORE',
    IDLE_NEAR = 'IDLE_NEAR',
    // Also used for various logics that have idle states in the river
    // e.g. ambush, wolf, swim away
    IDLE_WATER = 'IDLE_WATER',
    // For EnteringWaterLogic
    ENTERING_WATER = 'ENTERING_WATER',
    // For AmbushAttackLogic and WolfAttackLogic
    PREPARING_ATTACK = 'PREPARING_ATTACK',
    ATTACKING = 'ATTACKING',
    // For DefaultSwimAwayLogic
    SWIMING_AWAY = 'SWIMING_AWAY',
    // For ShoreWalkLogic
    WALKING = 'WALKING',
    // For BuzzBoatFlightLogic, FlyDirectToShoreLogic, FlyOppositeBoatLogic
    // ShoreLandingFlightLogic, WanderingFlightLogic, WaterLandingFlightLogic
    FLYING = 'FLYING',
}

import { AnimalLogicConfig } from './AnimalLogicConfigs';

/**
 * Shared context passed to ALL animal logic modules every frame.
 */
export interface AnimalLogicContext extends AnimalStrategyContext {
}

/**
 * A script function that returns the next logic to run.
 */
export type AnimalLogicScriptFn = (step: number, lastResult: string) => AnimalLogicScript | null;

/**
 * A script is either a single config (for simple behaviors) or a function
 * that generates a sequence of behaviors.
 */
export type AnimalLogicScript = AnimalLogicConfig | AnimalLogicScriptFn;

export class AnimalLogicStep {
    /** Play each script in sequence */
    public static sequence(sequence: AnimalLogicScript[]) {
        return (step: number, lastResult: string) => sequence[step] ?? null;
    }

    /** Play script until it returns 'result' or maximum iteration count */
    public static until(result: string | null, count: number, script: AnimalLogicScript) {
        return (step: number, lastResult: string) => {
            if (lastResult === result || step >= count) return null;
            return script;
        }
    }

    /** Randomly choose a script */
    public static random(choices: AnimalLogicScript[]) {
        return (step: number, lastResult: string) => {
            if (step > 0 || choices.length === 0) return null;
            const index = Math.floor(Math.random() * choices.length);
            return choices[index];
        }
    }

    /** Loop a sequence of scripts indefinitely */
    public static loop(sequence: AnimalLogicScript[], debug?: string) {
        return (step: number, lastResult: string) => {
            const next = sequence[step % sequence.length];
            if (debug !== undefined) {
                console.log(debug, step, lastResult, next);
            }
            return next;
        }
    }
}

/**
 * Standardized result from any animal logic calculation.
 */
export interface AnimalLogicPathResult {
    // Composition: Holds the physical path result (Steering or Explicit)
    path: AnimalSteering;

    // The physics model to use for this frame
    locomotionType: LocomotionType;

    // --- Result / Continuation ---

    // If set, the current logic is finished with this result string.
    result?: string;

    // If result is set, this flag controls transition behavior:
    // - true: Apply the current frame's steering, then switch logic next frame.
    // - false (undefined): Switch logic IMMEDIATELY (disengage), ignoring current steering.
    finish?: boolean;
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
