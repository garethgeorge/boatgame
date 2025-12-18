import * as THREE from 'three';

export class AnimationPlayer {

    private mixer: THREE.AnimationMixer;
    private currentAction: THREE.AnimationAction | null = null;
    private actions: Map<string, THREE.AnimationAction> = new Map();

    constructor(group: THREE.Group, animations: THREE.AnimationClip[]) {
        this.mixer = new THREE.AnimationMixer(group);
        for (const clip of animations) {
            const action = this.mixer.clipAction(clip);
            this.actions.set(clip.name, action);
        }
    }

    public play(name: string, options: { timeScale?: number, startTime?: number } = {}) {
        const { timeScale = 1.0, startTime = 0.0 } = options;

        const newAction = this.actions.get(name);
        if (!newAction) {
            return;
        }

        if (this.currentAction === newAction) {
            this.mixer.timeScale = timeScale;
            return;
        }

        newAction.reset();

        if (startTime < 0) {
            newAction.time = Math.random() * newAction.getClip().duration;
        } else {
            newAction.time = startTime;
        }

        newAction.setLoop(THREE.LoopRepeat, Infinity);
        newAction.play();
        this.mixer.timeScale = timeScale;

        if (this.currentAction) {
            this.currentAction.crossFadeTo(newAction, 1.0, true);
        }

        this.currentAction = newAction;
    }

    public getDuration(name: string): number {
        const action = this.actions.get(name);
        if (action) {
            return action.getClip().duration;
        }
        return 0;
    }

    public update(dt: number) {
        this.mixer.update(dt);
    }
}
