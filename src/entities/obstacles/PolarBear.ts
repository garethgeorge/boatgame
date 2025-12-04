import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

export class PolarBear extends Entity {
    private applyModel(model: THREE.Group, animations: THREE.AnimationClip[]) {
        // Apply model transformations
        model.scale.set(3.0, 3.0, 3.0);
        //model.rotation.y = Math.PI;
        //model.position.y = -1.0;

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
        worldX: number,
        worldZ: number,
        physicsEngine: PhysicsEngine,
        angle: number = 0,
        height: number,
        terrainNormal?: THREE.Vector3,
        facingAngle?: number
    ) {
        super();

        // No physics for now because this will cause the mesh to
        // be sync'ed with the physics body position which isn't
        // calculated correctly on shore.
        if (false) {
            const physicsBody = physicsEngine.world.createBody({
                type: 'dynamic',
                position: planck.Vec2(worldX, worldZ),
                angle: angle,
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

            physicsBody.setUserData({ type: 'obstacle', subtype: 'polarbear', entity: this });
        }

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        const bearData = Decorations.getPolarBear();
        if (bearData) {
            this.applyModel(bearData.model, bearData.animations);
        }

        // Apply terrain-based positioning
        // Note: The Entity.sync() method automatically sets mesh.position.x and mesh.position.z
        // from the physics body position
        mesh.position.set(worldX, height, worldZ);

        if (terrainNormal && facingAngle !== undefined) {
            // Align model's Y-axis with terrain normal
            const modelUpAxis = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(modelUpAxis, terrainNormal);
            mesh.quaternion.copy(quaternion);

            // Rotate around normal to face desired direction
            const rotationAroundNormal = new THREE.Quaternion();
            rotationAroundNormal.setFromAxisAngle(terrainNormal, facingAngle);
            mesh.quaternion.premultiply(rotationAroundNormal);
        }
    }

    private mixer: THREE.AnimationMixer | null = null;

    onHit() {
        this.shouldRemove = true;
    }

    update(dt: number) {
        if (this.mixer) {
            this.mixer.update(dt);
        }

        if (false && this.physicsBodies.length === 0) {
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

        // Polar bears are mostly idle on shore, no aggressive AI
        // Future Enhancement: Could add behavior like wandering, reacting to boat, etc.
    }
}
