import * as THREE from 'three';

export interface AnimationParameters {
    name: string;

    // -1 => randomize the start time
    startTime?: number;

    // use one of these to specify length, random parameter specifies
    // a +/- factor for random length adjustment
    timeScale?: number;
    duration?: number;
    randomizeLength?: number;

    // Number of times to repeat. Defaults to 1. Use Infinity for looping.
    repeat?: number;
}

export type AnimationScript = AnimationParameters | ((step: number) => AnimationScript | null);

export class AnimationStep {
    public static sequence(sequence: AnimationScript[]) {
        return (step: number) => sequence[step] ?? null;
    }

    /** Randomly choose a script repeat times */
    public static random(repeat: number, weights: number[], choices: AnimationScript[]) {
        return (step: number, lastResult: string) => {
            if (step >= repeat || choices.length === 0) return null;

            let r = Math.random();
            for (let i = 0; i < weights.length; i++) {
                if (r < weights[i]) return choices[i];
                r -= weights[i];
            }

            return choices[choices.length - 1];
        }
    }
}

interface ScriptStackItem {
    func: (step: number) => AnimationScript | null;
    step: number;
}

export class AnimationPlayer {
    public static readonly NONE = 'none';

    private readonly mixer: THREE.AnimationMixer;
    private readonly actions: Map<string, THREE.AnimationAction> = new Map();

    private scriptStack: ScriptStackItem[] = [];

    private currentAction: THREE.AnimationAction | null = null;
    private delayTimer: number = 0;

    private throttle: number = 1;
    private throttleFrameCount: number = 0;
    private accumulatedDt: number = 0;

    constructor(group: THREE.Group, animations: THREE.AnimationClip[]) {
        this.mixer = new THREE.AnimationMixer(group);
        for (const clip of animations) {
            const action = this.mixer.clipAction(clip);
            this.actions.set(clip.name, action);
        }

        this.mixer.addEventListener('finished', () => {
            this.playNextScriptStep();
        });
    }

    public stopAll() {
        this.mixer.stopAllAction();
        this.currentAction = null;
        this.scriptStack = [];
        this.delayTimer = 0;
    }

    public play(script: AnimationScript) {
        // Discard currently running script
        this.scriptStack = [];
        this.delayTimer = 0;

        if (typeof script === 'function') {
            this.scriptStack.push({ func: script, step: 0 });
            this.playNextScriptStep();
        } else {
            this.playAction(script);
        }
    }

    public getDuration(name: string): number {
        if (name === AnimationPlayer.NONE) return 1.0;

        const action = this.actions.get(name);
        if (action) {
            return action.getClip().duration;
        }
        return 0;
    }

    public getAction(name: string): THREE.AnimationAction | undefined {
        return this.actions.get(name);
    }

    public setThrottle(throttle: number) {
        this.throttle = Math.max(1, Math.floor(throttle));
    }

    public update(dt: number) {
        this.accumulatedDt += dt;
        this.throttleFrameCount++;

        if (this.throttleFrameCount >= this.throttle) {
            const updateDt = this.accumulatedDt;
            this.accumulatedDt = 0;
            this.throttleFrameCount = 0;

            this.mixer.update(updateDt);
            if (this.delayTimer > 0) {
                this.delayTimer -= updateDt;
                if (this.delayTimer <= 0) {
                    this.delayTimer = 0;
                    this.playNextScriptStep();
                }
            }
        }
    }

    private playNextScriptStep() {
        while (this.scriptStack.length > 0) {
            const item = this.scriptStack[this.scriptStack.length - 1];
            const result = item.func(item.step++);

            if (result === null) {
                this.scriptStack.pop();
                continue;
            }

            if (typeof result === 'function') {
                this.scriptStack.push({ func: result, step: 0 });
                continue;
            }

            // result is AnimationParameters
            if (this.playAction(result)) {
                return;
            } else {
                // If it failed to play, try next step
                continue;
            }
        }
    }

    private playAction(options: AnimationParameters): boolean {

        let {
            name,
            startTime = 0.0,
            timeScale = 1.0,
            duration = undefined,
            randomizeLength = undefined,
            repeat = 1
        } = options;

        let action: THREE.AnimationAction | undefined = undefined;
        let baseDuration = 1.0;

        if (name !== AnimationPlayer.NONE) {
            action = this.actions.get(name);
            if (!action) {
                return false;
            }
            baseDuration = action.getClip().duration;
        }

        let randomFactor = 1.0;
        if (randomizeLength !== undefined) {
            randomFactor = 1.0 + (Math.random() * 2 - 1) * randomizeLength;
        }

        let finalTimeScale = timeScale;
        if (duration !== undefined) {
            finalTimeScale = baseDuration / duration;
        }
        finalTimeScale /= randomFactor;

        // Handle delay case
        if (name === AnimationPlayer.NONE) {
            const totalDuration = (baseDuration / finalTimeScale) * repeat;
            this.delayTimer = totalDuration;

            if (this.currentAction) {
                this.currentAction.paused = true;
            }
            return true;
        }

        const mode = (repeat === 1) ? THREE.LoopOnce : THREE.LoopRepeat;
        const repetitions = repeat;

        // If action is current and already has correct parameters, just return
        if (this.currentAction === action) {
            action.paused = false;
            if (action.isRunning() &&
                action.loop === mode &&
                Math.abs(action.timeScale - finalTimeScale) < 0.001) {
                return true;
            }
        }

        // Check if we just need to update parameters of the running action
        if (this.currentAction === action && action.isRunning()) {
            action.timeScale = finalTimeScale;
            action.setLoop(mode, repetitions);
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
            this.currentAction.crossFadeTo(action, 0.25, false);
        }

        this.currentAction = action;
        return true;
    }

}
