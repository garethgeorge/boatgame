import * as THREE from 'three';
import { EntityBehavior } from './EntityBehavior';

export interface ObstacleHitBehaviorParams {
    duration?: number;
    rotateSpeed?: number;
    targetHeightOffset?: number;
}

export class ObstacleHitBehavior implements EntityBehavior {
    private meshes: THREE.Object3D[];
    private onComplete: () => void;
    private verticalSpeed: number;
    private rotateSpeed: number;
    private targetHeightOffset: number;
    private currentHeightChange: number = 0;

    constructor(meshes: THREE.Object3D[], onComplete: () => void, params: ObstacleHitBehaviorParams = {}) {
        this.meshes = meshes;
        this.onComplete = onComplete;

        this.targetHeightOffset = params.targetHeightOffset ?? 5;
        const duration = params.duration ?? 0.5;
        this.rotateSpeed = params.rotateSpeed ?? 25;

        this.verticalSpeed = this.targetHeightOffset / duration;
    }

    update(dt: number) {
        if (this.meshes.length === 0) {
            this.onComplete();
            return;
        }

        const dy = dt * this.verticalSpeed;
        const drot = dt * this.rotateSpeed;

        this.currentHeightChange += dy;

        for (const mesh of this.meshes) {
            mesh.position.y += dy;
            mesh.rotation.y += drot;
        }

        if (this.verticalSpeed > 0) {
            if (this.currentHeightChange >= this.targetHeightOffset) {
                this.onComplete();
            }
        } else {
            if (this.currentHeightChange <= this.targetHeightOffset) {
                this.onComplete();
            }
        }
    }

    updatePhysics(dt: number) {
    }

    updateVisuals(dt: number, alpha: number) {
    }

    updateSceneGraph() {
    }
}
