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
    timeout?: number;
    params?: Record<string, any>;
}

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

    /** Play script until it returns 'result' */
    public static until(result: string, script: AnimalLogicScript) {
        return (step: number, lastResult: string) => {
            if (lastResult === result) return null;
            return script;
        }
    }

    /** Randomly choose a script */
    public static random(choices: AnimalLogicScript[]) {
        return (step: number, lastResult: string) => {
            if (choices.length === 0) return null;
            const index = Math.floor(Math.random() * choices.length);
            return choices[index];
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
