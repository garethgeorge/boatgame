import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { AnimalBehavior } from '../behaviors/AnimalBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle } from '../behaviors/AttackAnimal';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';

export class Monkey extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle {
    private danceAction: THREE.AnimationAction | null = null;
    private swimAction: THREE.AnimationAction | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    private behavior: AnimalBehavior | null = null;
    private aggressiveness: number;

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

            if (danceClip) {
                this.danceAction = this.mixer.clipAction(danceClip);
            }

            if (swimClip) {
                this.swimAction = this.mixer.clipAction(swimClip);
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
        this.aggressiveness = Math.random();

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

        // Use -1.0 target water height (similar to Alligator)
        if (onShore) {
            if (!stayOnShore) {
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            }
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        }

        if (onShore && this.danceAction) {
            this.danceAction.play();
        } else if (!onShore && this.swimAction) {
            if (this.mixer) this.mixer.timeScale = 2.5;
            this.swimAction.play();
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
            this.behavior.update();
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
        // Crossfade from dance to swim
        if (this.swimAction) {
            this.swimAction.reset();
            this.swimAction.play();
            if (this.mixer) {
                this.mixer.timeScale = 2.5;
            }
        }
        if (this.danceAction && this.swimAction) {
            this.danceAction.crossFadeTo(this.swimAction, 1.0, true);
        }
    }

    didCompleteEnteringWater(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
    }

    shouldStartEnteringWater(): boolean {
        const targetWaterHeight = -1.25;

        // Create entering water behavior
        const behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            targetWaterHeight,
            this.aggressiveness
        );
        this.behavior = behavior;

        // Use duration from behavior for animation callbacks
        this.didStartEnteringWater(behavior.duration);

        return true;
    }

}
