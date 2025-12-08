import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine, CollisionCategories } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';

import { AttackAnimalBehavior } from '../behaviors/AttackAnimalBehavior';
import { AttackAnimal } from '../behaviors/AttackAnimal';

export class Alligator extends Entity implements AttackAnimal {
    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;

        if (this.meshes.length > 0) {
            this.meshes[0].add(model);
        }

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            // Randomize speed between 1.8 and 2.2
            this.mixer.timeScale = 1.8 + Math.random() * 0.4;
            const action = this.mixer.clipAction(animations[0]);
            // Randomize start time
            action.time = Math.random() * action.getClip().duration;
            action.play();
        }
    }

    constructor(
        x: number,
        y: number,
        physicsEngine: PhysicsEngine,
        angle: number = 0,
        height?: number,
        terrainNormal?: THREE.Vector3,
        onShore: boolean = false,
        stayOnShore: boolean = false
    ) {
        super();

        // Physics
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            angle: -angle,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.0, 3.0), // 2m wide, 6m long (Doubled)
            density: 5.0,
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'alligator', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        const alligatorData = Decorations.getAlligator();
        if (alligatorData) {
            this.applyModel(alligatorData.model, alligatorData.animations);
        }

        // Set height
        if (height !== undefined)
            mesh.position.y = height;
        else
            mesh.position.y = -1.0;

        // Set terrain alignment
        if (terrainNormal)
            this.normalVector = terrainNormal.clone();
        else
            this.normalVector = new THREE.Vector3(0, 1, 0);

        this.behavior = new AttackAnimalBehavior(this, onShore, -1.0, stayOnShore);
    }

    private mixer: THREE.AnimationMixer | null = null;
    private behavior: AttackAnimalBehavior;

    onHit() {
        this.shouldRemove = true;
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }

        if (this.physicsBodies.length === 0) {
            // Sinking animation
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
}
