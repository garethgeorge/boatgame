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

export class ScriptStep {
    public static sequence(sequence: AnimationScript[]) {
        return (step: number) => sequence[step] ?? null;
    }
}

interface ScriptStackItem {
    func: (step: number) => AnimationScript | null;
    step: number;
}

export class AnimationPlayer {

    private readonly mixer: THREE.AnimationMixer;
    private readonly actions: Map<string, THREE.AnimationAction> = new Map();

    private scriptStack: ScriptStackItem[] = [];

    private currentAction: THREE.AnimationAction | null = null;

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
    }

    public play(script: AnimationScript) {
        // Discard currently running script
        this.scriptStack = [];

        if (typeof script === 'function') {
            this.scriptStack.push({ func: script, step: 0 });
            this.playNextScriptStep();
        } else {
            this.playAction(script);
        }
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

        const action = this.actions.get(name);
        if (!action) {
            return false;
        }

        const mode = repeat === Infinity ? THREE.LoopRepeat : THREE.LoopOnce;
        const repetitions = repeat;

        let randomFactor = 1.0;
        if (randomizeLength !== undefined) {
            randomFactor = 1.0 + (Math.random() * 2 - 1) * randomizeLength;
        }

        let finalTimeScale = timeScale;
        if (duration !== undefined) {
            finalTimeScale = action.getClip().duration / duration;
        }
        finalTimeScale /= randomFactor;

        // If action is current and already has correct parameters, just return
        if (this.currentAction === action &&
            action.isRunning() &&
            action.loop === mode &&
            Math.abs(action.timeScale - finalTimeScale) < 0.001) {
            return true;
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
            this.currentAction.crossFadeTo(action, 0.25, true);
        }

        this.currentAction = action;
        return true;
    }

}
