import * as planck from 'planck';
import * as THREE from 'three';
import { CollisionCategories } from '../../core/PhysicsEngine';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';
import { AttackAnimalShore } from './AttackAnimal';
import { AnimalBehavior } from './AnimalBehavior';

export class AttackAnimalShoreBehavior implements AnimalBehavior {
    private entity: AttackAnimalShore;
    private state: 'ONSHORE' | 'ENTERING_WATER' = 'ONSHORE';
    private targetWaterHeight: number;
    private speed: number;
    private enterWaterDistance: number;

    constructor(
        entity: AttackAnimalShore,
        targetWaterHeight: number
    ) {
        this.entity = entity;
        this.targetWaterHeight = targetWaterHeight;

        const aggressiveness = Math.random();
        this.speed = 1 + 3 * aggressiveness;
        this.enterWaterDistance = 100 + 100 * aggressiveness;
    }

    update() {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return;

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
        }
    }

    private updateOnShore(dist: number, physicsBody: planck.Body) {
        // Activate when boat is within distance
        if (dist < this.enterWaterDistance) {
            this.state = 'ENTERING_WATER';

            const moveSpeed = 8.0 * this.speed;

            // Calculate distance to water
            // We need to know which bank is closer to determine direction
            const banks = RiverSystem.getInstance().getBankPositions(physicsBody.getPosition().y);
            const margin = 2.0;

            let distanceToWater = 0;
            const x = physicsBody.getPosition().x;
            if (x < banks.left) {
                distanceToWater = banks.left - x;
            } else {
                distanceToWater = x - banks.right;
            }
            distanceToWater += margin;
            distanceToWater = Math.max(0, distanceToWater);

            const duration = distanceToWater / moveSpeed;

            this.entity.didStartEnteringWater?.(duration);

            // Ignore terrain collision
            this.setCollisionMask(physicsBody, 0xFFFF ^ CollisionCategories.TERRAIN);
        }
    }

    private updateEnteringWater(pos: planck.Vec2, physicsBody: planck.Body) {
        // Move forward in current facing direction
        const speed = 8.0 * this.speed; // Walking speed
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
        const targetHeight = this.targetWaterHeight;
        const targetNormal = new THREE.Vector3(0, 1, 0);

        const epsilon = 0.1;

        if (distIntoWater < epsilon) {
            // Still on land
            const height = RiverSystem.getInstance().terrainGeometry.calculateHeight(pos.x, pos.y);
            const normal = RiverSystem.getInstance().terrainGeometry.calculateNormal(pos.x, pos.y);
            this.entity.setLandPosition(height, normal);
        } else if (distIntoWater < 0) {
            // Close to water edge don't update height/normal because it's not stable 
        } else if (distIntoWater < margin) {
            // Transition zone - interpolate
            const t = distIntoWater / margin;

            // Interpolate height
            const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(pos.x, pos.y);
            const height = THREE.MathUtils.lerp(terrainHeight, targetHeight, t);

            // Interpolate normal
            const terrainNormal = RiverSystem.getInstance().terrainGeometry.calculateNormal(pos.x, pos.y);
            const normal = terrainNormal.clone().lerp(targetNormal, t).normalize();

            this.entity.setLandPosition(height, normal);
        } else {
            // Fully in water
            // Restore collision with terrain
            this.setCollisionMask(physicsBody, 0xFFFF);

            // Trigger completion callback
            this.entity.didCompleteEnteringWater?.(this.speed);
        }
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
