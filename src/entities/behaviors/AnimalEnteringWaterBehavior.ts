import * as planck from 'planck';
import * as THREE from 'three';
import { CollisionCategories } from '../../core/PhysicsEngine';
import { RiverSystem } from '../../world/RiverSystem';
import { AnimalEnteringWater } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalBehaviorUtils } from './AnimalBehaviorUtils';

export class AnimalEnteringWaterBehavior implements EntityBehavior {
    private entity: AnimalEnteringWater;
    private targetWaterHeight: number;
    private speed: number;

    // when entering the water we need to know where we started and how far we have traveled
    private entryStartPosition: planck.Vec2 | null = null;
    private totalEntryDistance: number = 0;

    // Public properties that animals can use for animation callbacks
    public readonly duration: number;

    constructor(
        entity: AnimalEnteringWater,
        targetWaterHeight: number,
        aggressiveness: number
    ) {
        this.entity = entity;
        this.targetWaterHeight = targetWaterHeight;
        this.speed = 1 + 3 * aggressiveness;

        const physicsBody = entity.getPhysicsBody();
        if (!physicsBody) {
            this.duration = 0;
            return;
        }

        // Calculate distance to water
        const facingAngle = physicsBody.getAngle() - Math.PI / 2;
        const direction = planck.Vec2(Math.cos(facingAngle), Math.sin(facingAngle));

        let distanceToWater = RiverSystem.getInstance().getDistanceToWater(physicsBody.getPosition(), direction);

        // No water found, stay on shore
        if (distanceToWater < 0) {
            this.duration = 0;
            return;
        }

        // Add margin to ensure we are fully in water
        const margin = 2.0;
        distanceToWater += margin;

        // Initialize entry tracking
        this.entryStartPosition = physicsBody.getPosition().clone();
        this.totalEntryDistance = distanceToWater;

        // Calculate duration for animation callbacks
        const moveSpeed = 8.0 * this.speed;
        this.duration = distanceToWater / moveSpeed;

        // Ignore terrain collision
        AnimalBehaviorUtils.setCollisionMask(physicsBody, 0xFFFF ^ CollisionCategories.TERRAIN);

        // Switch to kinematic for precise path control
        physicsBody.setType(planck.Body.KINEMATIC);

        // Calculate and set velocity needed to cross the distance
        const velocity = planck.Vec2(Math.cos(facingAngle), Math.sin(facingAngle)).mul(moveSpeed);
        physicsBody.setLinearVelocity(velocity);
        physicsBody.setAngularVelocity(0);
    }

    update(dt: number) {
        const physicsBody = this.entity.getPhysicsBody();
        if (!physicsBody) return;

        const pos = physicsBody.getPosition();

        // Velocity is handled by kinematic body now

        // Calculate progress
        let progress = 0;
        if (this.entryStartPosition && this.totalEntryDistance > 0) {
            const distTraveled = pos.clone().sub(this.entryStartPosition).length();
            progress = Math.min(1.0, distTraveled / this.totalEntryDistance);
        }

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
            this.entity.setLandPosition(height, normal, progress);
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

            this.entity.setLandPosition(height, normal, progress);
        } else {
            // Fully in water

            // Restore dynamic body type and collision
            physicsBody.setType(planck.Body.DYNAMIC);
            AnimalBehaviorUtils.setCollisionMask(physicsBody, 0xFFFF);

            // Trigger completion callback
            this.entity.enteringWaterDidComplete?.(this.speed);
        }
    }
}
