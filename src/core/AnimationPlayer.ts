import { AnimationGroup, Scene } from '@babylonjs/core';

export interface PlayOptions {
  name: string;
  speedRatio?: number; // Babylon uses speedRatio instead of timeScale
  timeScale?: number; // Compat
  loop?: boolean;
  startTime?: number; // Offset?
  randomizeLength?: number; // To offset start time randomly
}

export class AnimationPlayer {
  private animations: Map<string, AnimationGroup> = new Map();
  private currentAnimation: AnimationGroup | null = null;

  constructor() { }

  setAnimations(animations: AnimationGroup[]) {
    this.animations.clear();
    for (const anim of animations) {
      this.animations.set(anim.name, anim);
      anim.stop(); // Ensure stopped initially
    }
  }

  play(options: PlayOptions) {
    if (!options.name) return;
    const group = this.animations.get(options.name);

    // If not found, try finding by partial name matching logic if needed, 
    // but for now strict match.
    if (!group) {
      // console.warn("Animation not found:", options.name);
      return;
    }

    if (this.currentAnimation && this.currentAnimation !== group) {
      this.currentAnimation.stop();
    }

    this.currentAnimation = group;

    const speed = options.speedRatio ?? options.timeScale ?? 1.0;

    // Randomize start time?
    // Babylon AnimationGroups play from 0 to duration.
    // options.randomizeLength might mean "Start at a random offset".
    // options.startTime might mean "start at X"..

    let startFrame = 0;
    let endFrame = group.to;

    if (options.randomizeLength) {
      // If loop is true, we can just start at a random frame.
      const duration = group.to - group.from;
      startFrame = Math.random() * duration;
    }

    // If startTime is negative (as in -1.0 in Duckling), maybe it means offset?

    group.start(true, speed, group.from, group.to, false);

    // If we want to offset the animation (e.g. valid for loops), we can goToFrame
    if (startFrame > 0) {
      group.goToFrame(startFrame);
    }
  }

  stop() {
    if (this.currentAnimation) {
      this.currentAnimation.stop();
      this.currentAnimation = null;
    }
  }

  update(dt: number) {
    // Babylon handles animation updates automatically via Scene.
    // This method might be legacy or for manual control.
  }
}
