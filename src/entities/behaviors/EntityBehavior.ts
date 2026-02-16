import * as planck from 'planck';
import * as THREE from 'three';

export interface EntityBehavior {
    update(dt: number): void;
    updatePhysics(dt: number): void;
    updateVisuals(dt: number, alpha: number): void;
    updateSceneGraph(): void;
    getDynamicPose(pos: planck.Vec2, angle: number): { height: number, quaternion: THREE.Quaternion } | null;
}
