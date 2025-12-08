import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalBehavior } from '../behaviors/AttackAnimalBehavior';
import { AttackAnimal } from '../behaviors/AttackAnimal';

export class Monkey extends Entity implements AttackAnimal {
    private danceAction: THREE.AnimationAction | null = null;
    private swimAction: THREE.AnimationAction | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    private behavior: AttackAnimalBehavior;

    private applyModel(mesh: THREE.Group, onShore: boolean) {
        const monkeyData = Decorations.getMonkey();
        if (!monkeyData)
            return;

        const model = monkeyData.model;
        const animations = monkeyData.animations;

        mesh.add(model);

        // Apply model transformations
        // Assuming 2.0 scale (smaller than bears 3.0)
        model.scale.set(2.0, 2.0, 2.0);
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
            shape: planck.Box(0.8, 0.8), // 1.6m wide, 1.6m long (Smaller than bear)
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
        this.behavior = new AttackAnimalBehavior(this, onShore, -1.0, stayOnShore);

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

        this.behavior.update();
    }

    // AttackAnimal interface implementation
    getPhysicsBody(): planck.Body | null {
        if (this.physicsBodies.length > 0) {
            return this.physicsBodies[0];
        }
        return null;
    }

    setLandPosition(height: number, normal: THREE.Vector3): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    setWaterPosition(height: number): void {
        if (this.meshes.length > 0) {
            this.meshes[0].position.y = height;
        }
        this.normalVector.set(0, 1, 0);
    }

    didStartEnteringWater(): void {
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
}
