import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AnimationPlayer } from '../../core/AnimationPlayer';
import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { AnimalSwimAwayBehavior } from '../behaviors/AnimalSwimAwayBehavior';
import { AnyAnimal } from '../behaviors/AnimalBehavior';

export class PenguinKayak extends Entity implements AnyAnimal {

    private aggressiveness: number = 1.0;
    private player: AnimationPlayer | null = null;
    private behavior: EntityBehavior | null = null;

    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(2.0, 2.0, 2.0);
        model.rotation.y = Math.PI / 2.0;
        model.position.y = -0.4;

        if (this.meshes.length > 0) {
            this.meshes[0].add(model);
        }

        this.player = new AnimationPlayer(model, animations);
    }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super();

        // Penguins can cause penalties when hit
        this.canCausePenalty = true;

        // Physics
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            angle: angle,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(1.5, 3.0), // Similar to hippo/alligator
            density: 5.0,
            friction: 0.1,
            restitution: 0.0
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'penguinKayak', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        mesh.position.y = 0.5; // Raised by ~15% of model height

        const penguinData = Decorations.getPenguinKayak();
        if (penguinData) {
            this.applyModel(penguinData.model, penguinData.animations);
        }

        this.behavior = new AnimalSwimAwayBehavior(this, this.aggressiveness);
        this.player.play({ name: 'paddling', timeScale: 2.0, randomizeLength: 0.2, startTime: -1 });
    }

    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    getHeight(): number {
        return this.meshes[0].position.y;
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

}
