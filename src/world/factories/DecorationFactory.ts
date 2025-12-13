import * as THREE from 'three';

export interface DecorationFactory {
    // pre-load
    load(): Promise<void>;

    // create mesh
    create(options?: any): THREE.Group;

    // create animation
    createAnimation?(name: string, options?: any): THREE.AnimationClip;

    // get all animations
    getAllAnimations?(): THREE.AnimationClip[];
}
