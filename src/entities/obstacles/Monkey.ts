import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { AnimalBehavior } from '../behaviors/AnimalBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle, AttackAnimalShoreWalk } from '../behaviors/AttackAnimal';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { AnimalShoreWalkBehavior } from '../behaviors/AnimalShoreWalkBehavior';

export class Monkey extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle, AttackAnimalShoreWalk {
    private readonly aggressiveness: number;

    private danceAction: THREE.AnimationAction | null = null;
    private swimAction: THREE.AnimationAction | null = null;
    private walkAction: THREE.AnimationAction | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    private behavior: AnimalBehavior | null = null;

    private applyModel(mesh: THREE.Group, onShore: boolean) {
        const monkeyData = Decorations.getMonkey();
        if (!monkeyData)
            return;

        const model = monkeyData.model;
        const animations = monkeyData.animations;

        mesh.add(model);

        // Apply model transformations
        // Assuming 2.0 scale (smaller than bears 3.0)
        model.scale.set(0.025, 0.025, 0.025);
        model.rotation.y = Math.PI;

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);

            // "dance" on shore, "swim" in water
            const danceClip = animations.find(a => a.name === 'dance');
            const swimClip = animations.find(a => a.name === 'swim');
            const walkClip = animations.find(a => a.name === 'walk');

            if (danceClip) {
                this.danceAction = this.mixer.clipAction(danceClip);
            }

            if (swimClip) {
                this.swimAction = this.mixer.clipAction(swimClip);
            }

            if (walkClip) {
                this.walkAction = this.mixer.clipAction(walkClip);
            }
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

        // Calculate aggressiveness for this monkey
        this.aggressiveness = stayOnShore ? 0.0 : Math.random();

        // Monkeys can cause penalties when hit
        this.canCausePenalty = true;

        // Physics - dynamic body
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(worldX, worldZ),
            angle: -angle,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.0, 1.0), // 1.6m wide, 1.6m long (Smaller than bear)
            density: 5.0,
            friction: 0.3,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'monkey', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Apply the monkey model
        this.applyModel(mesh, onShore);

        // Set height offset (Y position)
        mesh.position.y = height;

        // Set terrain normal
        if (terrainNormal) {
            this.normalVector = terrainNormal.clone();
        }

        if (onShore) {
            this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        }

        if (!onShore) {
            this.crossFadeAnimations(null, this.swimAction, 2.5);
        }
    }

    onHit() {
        this.shouldRemove = true;
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }

        if (this.physicsBodies.length === 0) {
            // Sinking animation when hit
            if (this.meshes.length > 0) {
                const mesh = this.meshes[0];
                mesh.position.y -= dt * 2;
                if (mesh.position.y < -2) {
                    this.shouldRemove = true;
                }
            }
            return;
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
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    didStartEnteringWater(duration: number): void {
        // Crossfade from dance (if playing) to swim
        this.crossFadeAnimations(this.danceAction, this.swimAction, 2.5);
    }

    didCompleteEnteringWater(speed: number): void {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
    }

    shouldStartEnteringWater(): void {
        const targetWaterHeight = -1.7;

        // Create entering water behavior
        const behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            targetWaterHeight,
            this.aggressiveness
        );
        this.behavior = behavior;

        // Use duration from behavior for animation callbacks
        this.didStartEnteringWater(behavior.duration);
    }

    shouldSwitchIdleBehavior(): void {
        // random choice between shore walk and dance/dont

        const rand = Math.random();
        if (rand < 0.5) {
            this.shouldStartShoreWalk();
        } else if (this.danceAction) {
            if (this.danceAction.isRunning()) {
                this.crossFadeAnimations(this.danceAction, null, 1.0);
            } else {
                this.crossFadeAnimations(null, this.danceAction, 1.0);
            }
        }
    }

    private shouldStartShoreWalk(): void {
        // Create shore walk behavior with random distance and speed
        const walkDistance = 10 + Math.random() * 10; // 10-20 meters
        const speed = 0.8 + Math.random() * 0.4; // 0.8-1.2x speed

        this.behavior = new AnimalShoreWalkBehavior(
            this,
            walkDistance,
            speed
        );

        this.crossFadeAnimations(this.danceAction, this.walkAction, 1.0);
    }

    didCompleteShoreWalk(): void {
        // Return to idle behavior after completing shore walk
        this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
        this.crossFadeAnimations(this.walkAction, null, 1.0);
    }

    // Note that "to" can be null to just stop from
    private crossFadeAnimations(from: THREE.AnimationAction,
        to: THREE.AnimationAction,
        timeScale: number) {

        // set up to so it loops
        if (to) {
            to.reset();
            to.setLoop(THREE.LoopRepeat, Infinity);
            to.play();
            if (this.mixer) {
                this.mixer.timeScale = timeScale;
            }
        }

        if (from && to) {
            // from is running, fade to to
            from.crossFadeTo(to, 1.0, true);
        }
        else if (from) {
            // nothing to fade to just stop when done
            from.setLoop(THREE.LoopOnce, 1);
            from.clampWhenFinished = true;
        }
        else {
            // to will just start running
        }
    }
}
