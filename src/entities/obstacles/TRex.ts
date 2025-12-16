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

export class TRex extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle {
    private animations: THREE.AnimationClip[] = [];
    private readonly TARGET_WATER_HEIGHT = -3.0;

    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(6.0, 6.0, 6.0);
        model.rotation.y = Math.PI;

        this.animations = animations;

        if (this.meshes.length > 0) {
            this.meshes[0].add(model);
        }

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            // Randomize speed 
            this.mixer.timeScale = 1.0 + Math.random() * 0.2;
        }
    }

    private playAnimation(name: string) {
        if (!this.mixer) return;

        const clip = this.animations.find(a => a.name === name);
        if (clip) {
            this.mixer.stopAllAction();
            const action = this.mixer.clipAction(clip);
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

        // Calculate aggressiveness for this trex
        this.aggressiveness = Math.random();

        // TRex can cause penalties when hit
        this.canCausePenalty = true;

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
            shape: planck.Box(1.5, 4.0), // Slightly larger than alligator
            density: 10.0, // Heavier
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'trex', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        const trexData = Decorations.getTRex();
        if (trexData) {
            this.applyModel(trexData.model, trexData.animations);
        }

        // Set height
        if (height !== undefined)
            mesh.position.y = height;
        else
            mesh.position.y = this.TARGET_WATER_HEIGHT;

        // Set terrain alignment
        if (terrainNormal)
            this.normalVector = terrainNormal.clone();
        else
            this.normalVector = new THREE.Vector3(0, 1, 0);

        if (onShore) {
            if (!stayOnShore)
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            this.playAnimation('standing');
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
            this.playAnimation('walking');
        }
    }

    private mixer: THREE.AnimationMixer | null = null;
    private behavior: EntityBehavior | null = null;
    private aggressiveness: number;

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
            this.meshes[0].position.y = height;
        }
        this.normalVector.copy(normal);
    }

    didCompleteEnteringWater(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
        // Animation should stay walking
    }

    shouldStartEnteringWater(): boolean {

        // Create entering water behavior
        this.behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            this.TARGET_WATER_HEIGHT,
            this.aggressiveness
        );

        this.playAnimation('walking');

        return true;
    }

}
