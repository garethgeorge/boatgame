import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { Decorations } from '../../world/Decorations';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';

import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle } from '../behaviors/AttackAnimalBehavior';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';

export class Alligator extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle {
    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;

        if (this.meshes.length > 0) {
            this.meshes[0].add(model);
        }

        this.player = new AnimationPlayer(model, animations);
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

        // Calculate aggressiveness for this alligator
        this.aggressiveness = Math.random();

        // Alligators can cause penalties when hit
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

        if (onShore) {
            if (!stayOnShore) {
                this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
            }
        } else {
            this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
            this.player.play({ name: 'walking', timeScale: 2.0, randomizeLength: 0.2, startTime: -1 });
        }
    }

    private player: AnimationPlayer | null = null;
    private behavior: EntityBehavior | null = null;
    private aggressiveness: number;

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 });
    }

    update(dt: number) {
        if (this.player) {
            this.player.update(dt);
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

    enteringWaterDidComplete(speed: number) {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
    }

    shoreIdleMaybeStartEnteringWater(): boolean {
        const targetWaterHeight = -1.0;

        // Create entering water behavior
        this.behavior = new AttackAnimalEnteringWaterBehavior(
            this,
            targetWaterHeight,
            this.aggressiveness
        );

        this.player.play({ name: 'walking', timeScale: 2.0, randomizeLength: 0.2, startTime: -1 });

        return true;
    }

}
