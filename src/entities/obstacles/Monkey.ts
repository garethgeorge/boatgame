import * as planck from 'planck';
import * as THREE from 'three';
import { AnimationPlayer } from '../../core/AnimationPlayer'
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

import { AttackAnimalShoreIdleBehavior } from '../behaviors/AttackAnimalShoreIdleBehavior';
import { AttackAnimalWaterBehavior } from '../behaviors/AttackAnimalWaterBehavior';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { AttackAnimalEnteringWater, AttackAnimalShoreIdle, AttackAnimalShoreWalk } from '../behaviors/AttackAnimalBehavior';
import { AttackAnimalEnteringWaterBehavior } from '../behaviors/AttackAnimalEnteringWaterBehavior';
import { AnimalShoreWalkBehavior } from '../behaviors/AnimalShoreWalkBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class Monkey extends Entity implements AttackAnimalEnteringWater, AttackAnimalShoreIdle, AttackAnimalShoreWalk {
    private readonly aggressiveness: number;
    private player: AnimationPlayer = null;
    private behavior: EntityBehavior | null = null;

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

        this.player = new AnimationPlayer(model, animations);
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

        if (onShore) {
            this.player.play({ name: 'idle', timeScale: 1.0 });
        } else {
            this.player.play({ name: 'swim', timeScale: 2.5 });
        }
    }

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

    didStartEnteringWater(duration: number): void {
        this.player.play({ name: 'swim', timeScale: 2.5 });
    }

    enteringWaterDidComplete(speed: number): void {
        this.behavior = new AttackAnimalWaterBehavior(this, this.aggressiveness);
        this.normalVector.set(0, 1, 0);
    }

    shoreIdleMaybeStartEnteringWater(): boolean {
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

        return true;
    }

    shoreIdleMaybeSwitchBehavior(): void {
        // random choice between shore walk and dance/dont

        const rand = Math.random();
        if (rand < 0.5) {
            this.shouldStartShoreWalk();
        } else {
            this.player.play({ name: 'dance', timeScale: 1.0 });
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

        this.player.play({ name: 'walk', timeScale: 1.0 });
    }

    shoreWalkDidComplete(): void {
        // Return to idle behavior after completing shore walk
        this.behavior = new AttackAnimalShoreIdleBehavior(this, this.aggressiveness);
        this.player.play({ name: 'idle', timeScale: 1.0 });
    }
}
