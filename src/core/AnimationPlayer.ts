import * as THREE from 'three';

export interface AnimationParameters {
    name: string;

    // Logical state name to identify what is playing (e.g. 'FLEEING', 'ATTACKING')
    // If provided, the player will skip redundant play() calls if the state matches.
    state?: string;

    // -1 => randomize the start time
    startTime?: number;

    // use one of these to specify length, random parameter specifies
    // a +/- factor for random length adjustment
    timeScale?: number;
    duration?: number;
    randomizeLength?: number;
}

export class AnimationPlayer {

    public readonly mixer: THREE.AnimationMixer;
    public currentAnimationState: string | null = null;
    private readonly actions: Map<string, THREE.AnimationAction> = new Map();
    private currentAction: THREE.AnimationAction | null = null;
    private sequence: AnimationParameters[] | null = null;
    private sequenceIndex: number = 0;
    private stateRandomFactors: Map<string, number> = new Map();

    constructor(group: THREE.Group, animations: THREE.AnimationClip[]) {
        this.mixer = new THREE.AnimationMixer(group);
        for (const clip of animations) {
            const action = this.mixer.clipAction(clip);
            this.actions.set(clip.name, action);
        }

        this.mixer.addEventListener('finished', () => {
            if (this.sequence) {
                this.playNextInSequence();
            }
        });
    }

    public stopAll() {
        this.mixer.stopAllAction();
        this.currentAction = null;
        this.currentAnimationState = null;
        this.sequence = null;
    }

    public playSequence(sequence: AnimationParameters[]) {
        this.stopAll();
        this.sequence = sequence;
        this.sequenceIndex = 0;
        this.playNextInSequence();
    }

    public playOnce(options: AnimationParameters, isPlayingSequenceStep: boolean = false) {
        if (!isPlayingSequenceStep) {
            this.sequence = null;
        }
        this.playAction(options, THREE.LoopOnce, 1);
    }

    public play(options: AnimationParameters) {
        this.sequence = null;
        this.playAction(options, THREE.LoopRepeat, Infinity);
    }

    public getDuration(name: string): number {
        const action = this.actions.get(name);
        if (action) {
            return action.getClip().duration;
        }
        return 0;
    }

    public getAction(name: string): THREE.AnimationAction | undefined {
        return this.actions.get(name);
    }

    public update(dt: number) {
        this.mixer.update(dt);
    }

    private playNextInSequence() {
        if (!this.sequence || this.sequenceIndex >= this.sequence.length) {
            this.sequence = null;
            this.currentAnimationState = null;
            return;
        }

        const step = this.sequence[this.sequenceIndex];
        this.sequenceIndex++;

        this.playAction(step, THREE.LoopOnce, 1);
    }

    private playAction(options: AnimationParameters,
        mode: THREE.AnimationActionLoopStyles,
        repetitions: number): boolean {

        let { name, state = null, startTime = 0.0, timeScale = 1.0, duration = undefined, randomizeLength = undefined } = options;

        const action = this.actions.get(name);
        if (!action) {
            return false;
        }

        const isSameStateFullMatch = state !== null && state === this.currentAnimationState && action.isRunning();

        let randomFactor = 1.0;
        if (state !== null) {
            if (this.currentAnimationState !== state) {
                randomFactor = 1.0 + (Math.random() * 2 - 1) * (randomizeLength ?? 0);
                this.stateRandomFactors.set(state, randomFactor);
            } else {
                randomFactor = this.stateRandomFactors.get(state) ?? 1.0;
            }
        } else if (randomizeLength !== undefined) {
            randomFactor = 1.0 + (Math.random() * 2 - 1) * randomizeLength;
        }

        let finalTimeScale = timeScale;
        if (duration !== undefined) {
            finalTimeScale = action.getClip().duration / duration;
        }
        finalTimeScale /= randomFactor;

        // If we are in the same state, check if we just need to update parameters
        if (isSameStateFullMatch) {
            if (Math.abs(action.timeScale - finalTimeScale) > 0.001 || action.loop !== mode) {
                // Update parameters without resetting the animation
                action.timeScale = finalTimeScale;
                action.setLoop(mode, repetitions);
            }
            return true;
        }

        // If action is current and already has correct parameters, just return
        if (this.currentAction === action &&
            action.isRunning() &&
            action.loop === mode &&
            Math.abs(action.timeScale - finalTimeScale) < 0.001) {
            this.currentAnimationState = state;
            return true;
        }

        action.reset();
        action.setLoop(mode, repetitions);
        action.clampWhenFinished = true;
        action.timeScale = finalTimeScale;

        if (startTime < 0) {
            action.time = Math.random() * action.getClip().duration;
        } else {
            action.time = startTime;
        }

        action.play();

        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.crossFadeTo(action, 0.25, true);
        }

        this.currentAction = action;
        this.currentAnimationState = state;
        return true;
    }

}
