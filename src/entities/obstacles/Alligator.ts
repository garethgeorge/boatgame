import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine, CollisionCategories } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';

export class Alligator extends Entity {
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
        onShore: boolean = false
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

        // Shore-specific setup
        if (onShore)
            this.state = 'ONSHORE';

        // Set terrain alignment
        if (terrainNormal)
            this.normalVector = terrainNormal.clone();
        else
            this.normalVector = new THREE.Vector3(0, 1, 0);
    }

    private mixer: THREE.AnimationMixer | null = null;

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

        this.updateAI();
    }

    private state: 'IDLE' | 'TURNING' | 'ATTACKING' | 'ONSHORE' | 'ENTERING_WATER' = 'IDLE';

    private updateAI() {
        const targetBody = Boat.getPlayerBody();
        if (!targetBody || this.physicsBodies.length === 0) return;

        const physicsBody = this.physicsBodies[0];
        const pos = physicsBody.getPosition();
        const target = targetBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        switch (this.state) {
            case 'ONSHORE':
                this.updateOnShore(dist, physicsBody);
                break;
            case 'ENTERING_WATER':
                this.updateEnteringWater(pos, physicsBody);
                break;
            case 'IDLE':
                this.updateIdle(dist);
                break;
            case 'TURNING':
                this.updateTurning(dist, diff, physicsBody);
                break;
            case 'ATTACKING':
                this.updateAttacking(dist, diff, physicsBody);
                break;
        }
    }

    private updateOnShore(dist: number, physicsBody: planck.Body) {
        // Activate when boat is within 100 units
        if (dist < 100) {
            this.state = 'ENTERING_WATER';

            // Ignore terrain collision
            this.setCollisionMask(physicsBody, 0xFFFF ^ CollisionCategories.TERRAIN);
        }
    }

    private updateEnteringWater(pos: planck.Vec2, physicsBody: planck.Body) {
        // Move forward in current facing direction
        const speed = 8.0; // Walking speed
        const angle = physicsBody.getAngle() - Math.PI / 2;
        physicsBody.applyForceToCenter(planck.Vec2(Math.cos(angle), Math.sin(angle)).mul(speed * physicsBody.getMass()));

        // Check if fully over water
        const banks = RiverSystem.getInstance().getBankPositions(pos.y);
        const margin = 2.0;

        // Calculate distance into water (positive means inside water area)
        const distFromLeft = pos.x - banks.left;
        const distFromRight = banks.right - pos.x;
        const distIntoWater = Math.min(distFromLeft, distFromRight);

        // Target (water) values
        const targetHeight = -1.0;
        const targetNormal = new THREE.Vector3(0, 1, 0);

        const epsilon = 0.1;

        if (distIntoWater < epsilon) {
            // Still on land
            const height = RiverSystem.getInstance().terrainGeometry.calculateHeight(pos.x, pos.y);
            this.meshes[0].position.y = height;

            const normal = RiverSystem.getInstance().terrainGeometry.calculateNormal(pos.x, pos.y);
            this.normalVector = normal;
        } else if (distIntoWater < 0) {
            // Close to water edge don't update height/normal because it's not stable 
        } else if (distIntoWater < margin) {
            // Transition zone - interpolate
            const t = distIntoWater / margin;

            // Interpolate height
            const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(pos.x, pos.y);
            this.meshes[0].position.y = THREE.MathUtils.lerp(terrainHeight, targetHeight, t);

            // Interpolate normal
            const terrainNormal = RiverSystem.getInstance().terrainGeometry.calculateNormal(pos.x, pos.y);
            this.normalVector.copy(terrainNormal).lerp(targetNormal, t).normalize();
        } else {
            // Fully in water
            this.state = 'IDLE';
            this.normalVector.copy(targetNormal);
            if (this.meshes.length > 0) {
                this.meshes[0].position.y = targetHeight;
            }

            // Restore collision with terrain
            this.setCollisionMask(physicsBody, 0xFFFF);
        }
    }

    private updateIdle(dist: number) {
        if (dist < 30) {
            this.state = 'TURNING';
        }
    }

    private updateTurning(dist: number, diff: planck.Vec2, physicsBody: planck.Body) {
        if (dist > 50) {
            this.state = 'IDLE';
            return;
        }

        if (dist < 30) {
            const angleDiff = this.calculateAngleToTarget(diff, physicsBody.getAngle());

            // Rotate towards target
            const rotationSpeed = 0.05; // Very slow turn
            physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));

            // Drag to stop movement while turning
            physicsBody.setLinearVelocity(physicsBody.getLinearVelocity().mul(0.9));

            // Check if facing target (within ~15 degrees = 0.26 rad)
            if (Math.abs(angleDiff) < 0.26) {
                this.state = 'ATTACKING';
            }
        }
    }

    private updateAttacking(dist: number, diff: planck.Vec2, physicsBody: planck.Body) {
        if (dist > 50) {
            this.state = 'IDLE';
            return;
        }

        if (dist < 30) {
            const angleDiff = this.calculateAngleToTarget(diff, physicsBody.getAngle());

            diff.normalize();
            // Move towards target
            const speed = 8.0; // Faster drift
            const force = diff.mul(speed * physicsBody.getMass());
            physicsBody.applyForceToCenter(force);

            // Continue rotating to track
            const rotationSpeed = 0.05;
            physicsBody.setAngularVelocity(angleDiff * rotationSpeed / (1 / 60));
        }
    }

    private calculateAngleToTarget(diff: planck.Vec2, currentAngle: number): number {
        const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        return angleDiff;
    }

    private setCollisionMask(body: planck.Body, maskBits: number) {
        for (let b = body.getFixtureList(); b; b = b.getNext()) {
            b.setFilterData({
                categoryBits: b.getFilterCategoryBits(),
                maskBits: maskBits,
                groupIndex: b.getFilterGroupIndex()
            });
        }
    }
}
