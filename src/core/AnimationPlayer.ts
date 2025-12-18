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
}

export class AnimationPlayer {

    public readonly mixer: THREE.AnimationMixer;
    private readonly actions: Map<string, THREE.AnimationAction> = new Map();
    private currentAction: THREE.AnimationAction | null = null;
    private sequence: AnimationParameters[] | null = null;
    private sequenceIndex: number = 0;

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
        this.sequence = null;
    }

    public playSequence(sequence: AnimationParameters[]) {
        this.stopAll();
        this.sequence = sequence;
        this.sequenceIndex = 0;
        this.playNextInSequence();
    }

    public playOnce(options: AnimationParameters, isPlayingSequenceStep: boolean = false) {
        this.sequence = null;
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
            return;
        }

        const step = this.sequence[this.sequenceIndex];
        this.sequenceIndex++;

        this.playAction(step, THREE.LoopOnce, 1);
    }

    private playAction(options: AnimationParameters,
        mode: THREE.AnimationActionLoopStyles,
        repetitions: number): boolean {

        let { name, startTime = 0.0, timeScale = 1.0, duration = undefined, randomizeLength = undefined } = options;
        const action = this.actions.get(name);
        if (!action) {
            return false;
        }

        if (startTime < 0) {
            action.time = Math.random() * action.getClip().duration;
        } else {
            action.time = startTime;
        }

        if (duration !== undefined) {
            timeScale = action.getClip().duration / duration;
        }

        if (randomizeLength !== undefined) {
            timeScale = timeScale + 2.0 * (Math.random() - 0.5) * randomizeLength;
        }

        if (this.currentAction === action &&
            action.isRunning &&
            action.loop === mode &&
            action.timeScale === timeScale) {
            return;
        }

        action.reset();
        action.setLoop(mode, repetitions);
        action.clampWhenFinished = true;
        action.timeScale = timeScale;
        action.play();

        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.crossFadeTo(action, 1.0, true);
        }

        this.currentAction = action;
    }

}
