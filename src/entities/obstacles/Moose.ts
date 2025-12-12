import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle } from '../behaviors/AttackAnimal';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export class Moose extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle {

    private readonly TARGET_WATER_HEIGHT = -3.0;

    private haveAnimations: boolean = false;
    private walkingAction: THREE.AnimationAction | null = null;
    private idleAction: THREE.AnimationAction | null = null;
    private jumpStartAction: THREE.AnimationAction | null = null;
    private jumpFallAction: THREE.AnimationAction | null = null;
    private jumpEndAction: THREE.AnimationAction | null = null;

    private mixer: THREE.AnimationMixer | null = null;
    private behavior: EntityBehavior | null = null;
    private aggressiveness: number;

    private applyModel(mesh: THREE.Group, onShore: boolean) {
        const mooseData = Decorations.getMoose();
        if (!mooseData)
            return;

        const model = mooseData.model;
        const animations = mooseData.animations;

        mesh.add(model);

        // Apply model transformations
        model.position.y = 3.0;
        model.scale.set(0.1, 0.1, 0.1);
        model.rotation.y = Math.PI;

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);

            const idleClip = animations.find(a => a.name === 'idle');
            const walkingClip = animations.find(a => a.name === 'walk');
            const jumpStartClip = animations.find(a => a.name === 'jump_start');
            const jumpFallClip = animations.find(a => a.name === 'jump_fall');
            const jumpEndClip = animations.find(a => a.name === 'jump_end');

            if (idleClip) {
                this.idleAction = this.mixer.clipAction(idleClip);
            }
            if (walkingClip) {
                this.walkingAction = this.mixer.clipAction(walkingClip);
            }
            if (jumpStartClip) {
                this.jumpStartAction = this.mixer.clipAction(jumpStartClip);
            }
            if (jumpFallClip) {
                this.jumpFallAction = this.mixer.clipAction(jumpFallClip);
            }
            if (jumpEndClip) {
                this.jumpEndAction = this.mixer.clipAction(jumpEndClip);
            }
            this.haveAnimations = this.idleAction !== null &&
                this.walkingAction !== null &&
                this.jumpStartAction !== null &&
                this.jumpFallAction !== null &&
                this.jumpEndAction !== null;
        }
    }

    constructor(
        worldX: number,
        worldZ: number,
        physicsEngine: PhysicsEngine,
        angle: number = 0,
        height: number,
        terrainNormal?: THREE.Vector3,
        onShore: boolean = false,
        stayOnShore: boolean = false
    ) {
        super();

        // Calculate aggressiveness for this moose
        this.aggressiveness = Math.random();

        // Moose can cause penalties when hit
        this.canCausePenalty = true;

        // Physics - dynamic body for potential future movement
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(worldX, worldZ),
            angle: -angle,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.5, 2.5), // 3m wide, 5m long
            density: 5.0,
            friction: 0.3,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'moose', entity: this });

        // Graphics - simple single mesh
        // Entity.syncBodyMesh() will handle position and rotation with normal
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Apply the moose model
        this.applyModel(mesh, onShore);

        // Set height offset (Y position)
        // Entity.sync() will control X and Z from physics body
        mesh.position.y = height;

        // Set terrain normal for Entity.syncBodyMesh() to use
        if (terrainNormal) {
            this.normalVector = terrainNormal.clone();
        }

        if (onShore) {
            if (!stayOnShore) {
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            }
            if (this.idleAction) {
                this.idleAction.time = Math.random() * this.idleAction.getClip().duration;
                this.idleAction.play();
            }
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
            if (this.walkingAction) {
                this.walkingAction.time = Math.random() * this.walkingAction.getClip().duration;
                this.walkingAction.play();
            }
        }
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

    // AttackAnimal interface implementation
    getPhysicsBody(): planck.Body | null {
        if (this.physicsBodies.length > 0) {
            return this.physicsBodies[0];
        }
        return null;
    }

    setLandPosition(height: number, normal: THREE.Vector3, progress: number): void {
        if (this.meshes.length > 0) {
            const t = Math.max(0, Math.min(progress, 1));
            const curve = 4 * t * (1.0 - t);
            const jumpHeight = 2.0 * curve;
            this.meshes[0].position.y = height + jumpHeight;
        }
        this.normalVector.copy(normal);
    }

    didStartEnteringWater(duration: number): void {
        if (!this.haveAnimations) {
            return;
        }

        if (duration > 0.5) {
            const startClip = this.jumpStartAction.getClip();
            const endClip = this.jumpEndAction.getClip();
            const fallClip = this.jumpFallAction.getClip();

            const startTimeScale = 0.5;
            const endTimeScale = 0.5;

            const startDuration = startClip.duration * startTimeScale;
            const endDuration = endClip.duration * endTimeScale;
            const fallDuration = duration - startTimeScale - endTimeScale;
            const fallTimeScale = fallDuration / fallClip.duration;

            this.jumpStartAction.timeScale = startTimeScale;
            this.jumpFallAction.timeScale = fallTimeScale;
            this.jumpEndAction.timeScale = endTimeScale;

            this.jumpStartAction.clampWhenFinished = true;
            this.jumpStartAction.loop = THREE.LoopOnce;

            this.jumpFallAction.loop = THREE.LoopOnce;
            this.jumpFallAction.clampWhenFinished = true;

            this.jumpEndAction.loop = THREE.LoopOnce;
            this.jumpEndAction.clampWhenFinished = true;

            // Using Mixer listener to chain
            const onLoopFinished = (e: any) => {
                if (e.action === this.jumpStartAction) {
                    this.jumpStartAction?.stop();
                    this.jumpFallAction?.play();
                } else if (e.action === this.jumpFallAction) {
                    this.jumpFallAction?.stop();
                    this.jumpEndAction?.play();
                }
            };
            this.mixer?.addEventListener('finished', onLoopFinished);

            this.idleAction.stop();
            this.walkingAction.stop();
            this.jumpStartAction.play();

        } else {
            this.walkingAction.reset();
            this.walkingAction.time = Math.random() * this.walkingAction.getClip().duration;
            this.walkingAction.play();
            this.idleAction.crossFadeTo(this.walkingAction, 1.0, true);
        }
    }

    didCompleteEnteringWater(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);

        if (this.meshes.length > 0) {
            this.meshes[0].position.y = this.TARGET_WATER_HEIGHT;
        }
        this.normalVector.set(0, 1, 0);

        // Transition to walking
        if (this.haveAnimations) {
            // Stop any jump actions
            this.jumpStartAction?.stop();
            this.jumpFallAction?.stop();
            this.jumpEndAction?.stop();

            // Play walking
            this.walkingAction.reset();
            this.walkingAction.time = Math.random() * this.walkingAction.getClip().duration;
            this.walkingAction.play();

            // Maybe crossfade from jump_end if it was playing? 
            // But jump_end should have finished or be close to finishing.
            if (this.jumpEndAction.isRunning()) {
                this.jumpEndAction.crossFadeTo(this.walkingAction, 0.5, true);
            }
        }
    }

    shouldStartEnteringWater(): boolean {

        // Create entering water behavior
        const behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            this.TARGET_WATER_HEIGHT,
            this.aggressiveness
        );
        this.behavior = behavior;

        // Use duration from behavior for animation callbacks
        this.didStartEnteringWater(behavior.duration);

        return true;
    }

}
