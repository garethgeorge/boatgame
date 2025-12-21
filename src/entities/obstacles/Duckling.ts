import * as planck from 'planck';
import { TransformNode, MeshBuilder, StandardMaterial, Color3, AnimationGroup } from "@babylonjs/core";
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AnimationPlayer } from '../../core/AnimationPlayer';
// import { EntityBehavior } from '../behaviors/EntityBehavior';
import { ObstacleHitBehavior } from '../behaviors/ObstacleHitBehavior';
import { AnimalSwimAwayBehavior } from '../behaviors/AnimalSwimAwayBehavior';
import { AnyAttackAnimal } from '../behaviors/AttackAnimalBehavior';

export class Duckling extends Entity implements AnyAttackAnimal {
    public static readonly HEIGHT_IN_WATER: number = 0.0;

    private aggressiveness: number = 1.0;
    private behavior: any | null = null;
    private player: AnimationPlayer = new AnimationPlayer();

    // private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
    //     // Apply model transformations
    //     model.scaling.set(1.0, 1.0, 1.0);
    //     model.rotation.y = Math.PI;
    //     model.position.y = -1.25;

    //     if (this.meshes.length > 0) {
    //         this.meshes[0].add(model);
    //     }

    //     this.player = new AnimationPlayer(model, animations);
    //     // Randomize speed between 1.8 and 2.2
    //     const timeScale = 1.8 + Math.random() * 0.4;
    // }

    constructor(x: number, y: number, physicsEngine: PhysicsEngine, angle: number = 0) {
        super();

        // Ducklings can cause penalties when hit
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

        physicsBody.setUserData({ type: 'obstacle', subtype: 'duckling', entity: this });

        // Graphics
        const mesh = new TransformNode("duckling");
        this.meshes.push(mesh);

        // Placeholder graphics (these lines were part of the original constructor,
        // but the new applyModel will handle the actual model)
        const duck = MeshBuilder.CreateSphere("duckBody", { diameter: 1.5 });
        const mat = new StandardMaterial("duckMat");
        mat.diffuseColor = Color3.Yellow();
        duck.material = mat;
        duck.parent = mesh; // Parent placeholder to the root mesh

        const ducklingData = Decorations.getDuckling();
        if (ducklingData) {
            this.applyModel(ducklingData.model, ducklingData.animations);
        }

        this.behavior = new AnimalSwimAwayBehavior(this, this.aggressiveness);
        this.player.play({ name: 'bob', timeScale: 2.0, randomizeLength: 0.2, startTime: -1.0 });
    }

    private applyModel(model: TransformNode, animations: AnimationGroup[]) {
        // Apply model transformations
        model.scaling.set(1.0, 1.0, 1.0);
        model.rotation.y = Math.PI;
        model.position.y = -1.25;

        // The first mesh in this.meshes is the root TransformNode created in the constructor.
        // We parent the loaded model to this root TransformNode.
        if (this.meshes.length > 0) {
            model.parent = this.meshes[0];
        } else {
            // If for some reason the root mesh wasn't created, add the model directly
            this.meshes.push(model);
        }

        // Setup Animation Player
        this.player.setAnimations(animations);
    }

    getPhysicsBody(): planck.Body | null {
        return this.physicsBodies.length > 0 ? this.physicsBodies[0] : null;
    }

    wasHitByPlayer() {
        this.destroyPhysicsBodies();
        this.behavior = new ObstacleHitBehavior(this.meshes, () => {
            this.shouldRemove = true;
        }, { duration: 0.5, rotateSpeed: 25, targetHeightOffset: 5 });
    }

    update(dt: number) {
        if (this.behavior) {
            this.behavior.update(dt);
        }
    }

}
