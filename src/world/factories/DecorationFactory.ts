import { TransformNode, AnimationGroup } from '@babylonjs/core';

export interface DecorationFactory {
    // pre-load
    load(): Promise<void>;

    // create mesh
    create(options?: any): TransformNode;

    // create animation
    createAnimation?(name: string, options?: any): AnimationGroup;

    // get all animations
    getAllAnimations?(): AnimationGroup[];
}
