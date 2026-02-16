import * as planck from 'planck';
import * as THREE from 'three';
import { AnyAnimal } from './AnimalBehavior';
import { AnimalLogicContext, AnimalLogicPathResult } from './logic/AnimalLogic';
import { PhysicsUtils } from '../../core/PhysicsUtils';
import { CollisionCategories } from '../../core/PhysicsEngine';
import { Zone } from './TerrainMap';
import { LocomotionType } from './logic/strategy/AnimalPathStrategy';

export class AnimalLocomotionController {
    private entity: AnyAnimal;
    private waterHeight: number;
    private marginWidth: number = 2.0;

    // Locomotion State
    private currentMode: LocomotionType = 'NONE';
    private currentZone: Zone | null = null;
    private currentBank: number = 0;
    private jumpActive: boolean = false;
    private jumpStartHeight: number = 0;
    private jumpHeight: number = 0;
    private jumpScale: number = 0;
    private jumpTraveledDistance: number = 0;

    private pendingKinematic: {
        pos: THREE.Vector3, angle: number, normal: THREE.Vector3, mode: LocomotionType
    } | null = null;
    private pendingDynamic: {
        linVel: planck.Vec2, angVel: number, mode: LocomotionType
    } | null = null;

    // Constants (moved from UniversalBehavior)
    private readonly VERT_SPEED: number = 10.0;
    private readonly ROTATION_SPEED_FLIGHT: number = Math.PI * 1.0;
    private readonly BANK_SPEED = Math.PI * 1.5;
    private readonly MAX_BANK = Math.PI * 0.3;

    constructor(entity: AnyAnimal, waterHeight: number) {
        this.entity = entity;
        this.waterHeight = waterHeight;
    }

    public computeLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        if (!result || !result.path) return;

        if (result.path.locomotionType !== 'LAND') {
            this.jumpActive = false;
        }

        switch (result.path.locomotionType) {
            case 'FLIGHT':
                this.computeFlightLocomotion(context, result);
                break;
            case 'LAND':
                this.computeLandLocomotion(context, result);
                break;
            case 'NONE':
                this.computeNoneLocomotion(context);
                break;
            case 'WATER':
            default:
                this.computeWaterLocomotion(context, result);
                break;
        }

        // Damp banking if not in FLIGHT
        if (result.path.locomotionType !== 'FLIGHT' && this.currentBank !== 0) {
            const bankChange = this.BANK_SPEED * context.dt;
            if (Math.abs(this.currentBank) < bankChange) {
                this.currentBank = 0;
            } else {
                this.currentBank -= Math.sign(this.currentBank) * bankChange;
            }
        }
    }

    public updatePhysics(dt: number) {
        if (this.pendingDynamic) {
            this.applyDynamicUpdate(this.pendingDynamic);
            this.pendingDynamic = null;
        }
    }

    public updateVisuals(dt: number) {
        if (this.pendingKinematic) {
            this.applyKinematicUpdate(this.pendingKinematic);
            this.pendingKinematic = null;
        }
    }

    private applyKinematicUpdate(update: {
        pos: THREE.Vector3, angle: number, normal: THREE.Vector3, mode: LocomotionType
    }) {
        const body = this.entity.getPhysicsBody();
        if (body) {
            this.setLocomotionMode(body, update.mode);
        }

        const mesh = this.entity.getMesh();
        if (!mesh) return;
        mesh.position.copy(update.pos);

        const up = new THREE.Vector3(0, 1, 0);
        const normalQuaternion = new THREE.Quaternion().setFromUnitVectors(up, update.normal);
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(update.normal, -update.angle);

        mesh.quaternion.multiplyQuaternions(rotationQuaternion, normalQuaternion);
    }

    private applyDynamicUpdate(update: {
        linVel: planck.Vec2, angVel: number, mode: LocomotionType
    }) {
        const body = this.entity.getPhysicsBody();
        if (!body) return;

        this.setLocomotionMode(body, update.mode);

        body.setLinearVelocity(update.linVel);
        body.setAngularVelocity(update.angVel);
    }

    public getDynamicPose(pos: planck.Vec2, angle: number): { height: number; quaternion: THREE.Quaternion } | null {
        const terrainMap = this.entity.getTerrainMap();
        const { zone } = terrainMap.zone(pos.x, pos.y, 0, 0);

        const up = new THREE.Vector3(0, 1, 0);
        let terrainHeight = 0;
        let terrainNormal = up;
        if (this.entity.currentSlot) {
            terrainHeight = this.entity.currentSlot.y;
        } else if (zone === 'water') {
            terrainHeight += this.waterHeight;
        } else {
            const sample = terrainMap.sample(pos.x, pos.y);
            terrainHeight = sample.y;
            terrainNormal = sample.normal;
        }

        const normalQuaternion = new THREE.Quaternion().setFromUnitVectors(up, terrainNormal);
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(terrainNormal, -angle);
        const quaternion = new THREE.Quaternion().multiplyQuaternions(rotationQuaternion, normalQuaternion);

        return { height: terrainHeight, quaternion };
    }

    private setLocomotionMode(body: planck.Body, locomotionType: LocomotionType) {

        if (this.currentMode === locomotionType) return;
        this.currentMode = locomotionType;

        switch (locomotionType) {
            case 'NONE': {
                break;
            }
            case 'WATER': {
                // Dynamic, all collisions enabled
                PhysicsUtils.setCollisionMask(body, 0xFFFF);
                body.setType(planck.Body.DYNAMIC);
                break;
            }
            case 'LAND': {
                // Kinematic, don't collide with river boundary
                PhysicsUtils.setCollisionMask(body, 0xFFFF & ~CollisionCategories.TERRAIN);
                body.setType(planck.Body.KINEMATIC);
                body.setLinearVelocity(planck.Vec2(0, 0));
                body.setAngularVelocity(0);
                break;
            }
            case 'FLIGHT': {
                // Kinematic, don't collide with anything
                PhysicsUtils.setCollisionMask(body, 0);
                body.setType(planck.Body.KINEMATIC);
                body.setLinearVelocity(planck.Vec2(0, 0));
                body.setAngularVelocity(0);
                break;
            }
        }
    }

    private computeNoneLocomotion(context: AnimalLogicContext) {
        const isKinematic = context.physicsBody.getType() === planck.Body.KINEMATIC;
        if (isKinematic) {
            this.pendingKinematic = null;
        } else {
            this.pendingDynamic = {
                linVel: planck.Vec2(0, 0),
                angVel: 0,
                mode: 'NONE'
            };
        }
    }

    private computeWaterLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {

        const steering = result.path;
        const { physicsBody, originPos, dt } = context;
        const targetWorldPos = steering.target;
        const desiredSpeed = steering.speed;

        const turnSpeed = steering.turningSpeed ?? Math.PI;
        const turnSmoothing = steering.turningSmoothing ?? 5.0;

        const originToTarget = targetWorldPos.clone().sub(originPos);
        const originToTargetDist = originToTarget.length();

        const desiredAngle = Math.atan2(originToTarget.x, -originToTarget.y);
        const currentAngle = physicsBody.getAngle();

        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const taper = Math.min(Math.abs(angleDiff) * 3.0, 1.0);
        const targetRotationSpeed = Math.sign(angleDiff) * turnSpeed * taper;
        const finalRotationSpeed = physicsBody.getAngularVelocity() + (targetRotationSpeed - physicsBody.getAngularVelocity()) * Math.min(1.0, turnSmoothing * dt * 60);

        const forwardDir = planck.Vec2(Math.sin(currentAngle), -Math.cos(currentAngle));
        const steerDir = originToTarget.clone();
        if (originToTargetDist > 0.1) steerDir.normalize();

        const alignment = Math.max(0, planck.Vec2.dot(forwardDir, steerDir));
        const snoutToTargetDist = planck.Vec2.distance(context.snoutPos, targetWorldPos);

        let targetSpeed = desiredSpeed * alignment;
        if (snoutToTargetDist < 2.0) targetSpeed *= (snoutToTargetDist / 2.0);

        const currentVel = physicsBody.getLinearVelocity();
        const targetVel = forwardDir.mul(targetSpeed);
        const nextVel = currentVel.clone().add(targetVel.clone().sub(currentVel).mul(Math.min(1.0, 5.0 * dt)));

        this.pendingDynamic = {
            linVel: nextVel,
            angVel: finalRotationSpeed,
            mode: 'WATER'
        };
    }

    private computeLandLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        const { dt } = context;
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        const nextPos = mesh.position.clone();
        const prevHorizontalPos = new THREE.Vector2(nextPos.x, nextPos.z);

        const steering = result.path;
        const targetLocalPos = new THREE.Vector3(steering.target.x, 0, steering.target.y);
        this.entity.worldToLocalPos(targetLocalPos);
        const desiredSpeed = steering.speed;

        const moveVec = targetLocalPos.clone().sub(nextPos);
        const distToTarget = new THREE.Vector2(moveVec.x, moveVec.z).length();

        if (distToTarget > 0.01) {
            const moveDist = Math.min(distToTarget, desiredSpeed * dt);
            const moveDir = new THREE.Vector2(moveVec.x, moveVec.z).normalize();
            nextPos.x += moveDir.x * moveDist;
            nextPos.z += moveDir.y * moveDist;
        }

        const currentAngle = this.entity.localAngle();
        let targetAngle = currentAngle;
        if (distToTarget > 0.1) {
            targetAngle = Math.atan2(moveVec.x, -moveVec.z);
        }

        let angleDiff = targetAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const rotationSpeed = steering.turningSpeed ?? 3.0;
        const maxRotation = rotationSpeed * dt;
        const rotation = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxRotation);
        const nextAngle = currentAngle + rotation;

        let { y: terrainHeight, normal: terrainNormal } =
            this.entity.getTerrainMap().sample(nextPos.x, nextPos.z);

        const { zone, t: tau } = this.entity.getTerrainMap().zone(
            nextPos.x, nextPos.z, 0, this.marginWidth);

        // Interpolate height and normal in the margin
        if (zone === 'margin') {
            terrainHeight = terrainHeight * (1 - tau) + (terrainHeight + this.waterHeight) * tau;

            const f = 4 * tau * (1 - tau); // Parabolic weight peaking at 0.5 (t=0.5)

            // Tilted normal: 45 degrees in direction of movement
            const moveDir = new THREE.Vector2(moveVec.x, moveVec.z).normalize();
            const tiltedNormal = new THREE.Vector3(moveDir.x, 1, moveDir.y).normalize();

            // Interpolate between terrainNormal and tiltedNormal
            terrainNormal.lerp(tiltedNormal, f).normalize();
        } else if (zone === 'water') {
            terrainHeight += this.waterHeight;
        }

        if (result.jump && !this.jumpActive) {
            this.jumpActive = true;
            this.jumpStartHeight = nextPos.y;
            this.jumpHeight = result.jump.height;
            this.jumpScale = result.jump.distance;
            this.jumpTraveledDistance = 0;
        }

        if (this.jumpActive) {
            const horizontalMoveDist = new THREE.Vector2(nextPos.x, nextPos.z).distanceTo(prevHorizontalPos);
            this.jumpTraveledDistance += horizontalMoveDist;

            const t = this.jumpTraveledDistance / this.jumpScale;
            const parabolicHeight = this.jumpStartHeight + 4 * t * (1 - t) * this.jumpHeight;

            if (parabolicHeight <= terrainHeight) {
                this.jumpActive = false;
                nextPos.y = terrainHeight;
            } else {
                nextPos.y = parabolicHeight;
            }
        } else {
            nextPos.y = terrainHeight;
        }

        this.pendingKinematic = {
            pos: nextPos,
            angle: nextAngle,
            normal: terrainNormal,
            mode: 'LAND'
        };
    }

    private computeFlightLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        const { dt } = context;
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        const nextPos = mesh.position.clone();

        const steering = result.path;
        const targetWorldPos = new THREE.Vector3(
            steering.target.x, steering.height ?? context.currentHeight, steering.target.y);
        const desiredSpeed = steering.speed;

        const moveVec = targetWorldPos.clone().sub(nextPos);
        const distToTarget = new THREE.Vector2(moveVec.x, moveVec.z).length();

        const currentAngle = this.entity.localAngle();
        const targetAngle = Math.atan2(moveVec.x, -moveVec.z);

        const turnSpeed = steering.turningSpeed ?? this.ROTATION_SPEED_FLIGHT;
        const { nextAngle, nextBank } = this.handleFlightRotationAndBanking(
            currentAngle, this.currentBank, targetAngle, turnSpeed, dt);
        this.currentBank = nextBank;

        if (distToTarget > 0.01) {
            const moveDist = Math.min(distToTarget, desiredSpeed * dt);
            const moveDir = new THREE.Vector2(moveVec.x, moveVec.z).normalize();
            nextPos.x += moveDir.x * moveDist;
            nextPos.z += moveDir.y * moveDist;
        }

        const currentHeight = context.currentHeight;
        let newHeight = currentHeight;
        if (currentHeight < targetWorldPos.y) {
            newHeight = Math.min(targetWorldPos.y, currentHeight + this.VERT_SPEED * dt);
        } else if (currentHeight > targetWorldPos.y) {
            newHeight = Math.max(targetWorldPos.y, currentHeight - this.VERT_SPEED * dt);
        }
        nextPos.y = newHeight;

        let normal = new THREE.Vector3(0, 1, 0);
        const bankingEnabled = steering.bankingEnabled ?? true;
        if (bankingEnabled) {
            normal = this.getBankingNormal(nextAngle, nextBank);
        }

        this.pendingKinematic = {
            pos: nextPos,
            angle: nextAngle,
            normal: normal,
            mode: 'FLIGHT'
        };
    }

    private handleFlightRotationAndBanking(
        currentAngle: number, currentBank: number, targetAngle: number,
        turnSpeed: number, dt: number
    ): { nextAngle: number, nextBank: number } {
        let diff = targetAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const maxRotation = turnSpeed * dt;
        const turnDirection = Math.sign(diff);

        if (Math.abs(diff) < maxRotation) {
            currentAngle = targetAngle;
        } else {
            currentAngle += turnDirection * maxRotation;
        }

        while (currentAngle > Math.PI) currentAngle -= Math.PI * 2;
        while (currentAngle < -Math.PI) currentAngle += Math.PI * 2;

        const targetIntensity = Math.min(1.0, Math.abs(diff) / (Math.PI / 4));
        const targetBank = turnDirection * targetIntensity * this.MAX_BANK;
        const bankDiff = targetBank - currentBank;
        const maxBankChange = this.BANK_SPEED * dt;

        if (Math.abs(bankDiff) < maxBankChange) {
            currentBank = targetBank;
        } else {
            currentBank += Math.sign(bankDiff) * maxBankChange;
        }

        return { nextAngle: currentAngle, nextBank: currentBank };
    }

    private getBankingNormal(angle: number, bank: number): THREE.Vector3 {
        const right = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const up = new THREE.Vector3(0, 1, 0);

        return up.multiplyScalar(Math.cos(bank))
            .add(right.multiplyScalar(Math.sin(bank)))
            .normalize();
    }

    public updateZone() {
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        // Sample the terrain map at the current position to get the zone
        const { zone } = this.entity.getTerrainMap().zone(
            mesh.position.x, mesh.position.z, 0, this.marginWidth);

        if (this.currentZone !== zone) {
            this.currentZone = zone;
            this.entity.handleBehaviorEvent?.({
                type: 'ZONE_CHANGED',
                zone: zone
            });
        }
    }
}
