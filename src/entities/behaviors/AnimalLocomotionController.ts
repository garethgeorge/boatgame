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
    private prevHorizontalPos: THREE.Vector2 | null = null;
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

    /**
     * Compute motion parameters without applying them.
     */
    public computeLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        if (!result || !result.path) return;

        // Capture the current position as the "previous" position before computing
        // the next movement.
        const body = this.entity.getPhysicsBody();
        if (body) {
            const pos = body.getPosition();
            this.prevHorizontalPos = new THREE.Vector2(pos.x, pos.y);
        }

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

    /**
     * Applies the computed physics parameters when the locomotion type is
     * dynamic.
     */
    public updatePhysics(dt: number) {
        if (this.pendingDynamic) {
            const body = this.entity.getPhysicsBody();
            if (!body) return;

            this.setLocomotionMode(body, this.pendingDynamic.mode);

            body.setLinearVelocity(this.pendingDynamic.linVel);
            body.setAngularVelocity(this.pendingDynamic.angVel);

            this.pendingDynamic = null;
        }
    }

    /**
     * Updates the visuals from the computed motion when the locomotion type
     * is kinematic.
     */
    public updateVisuals(dt: number) {
        if (this.pendingKinematic) {
            // For land motion now determine the pose for the current position
            if (this.pendingKinematic.mode !== 'FLIGHT') {
                const mesh = this.entity.getMesh();

                let globalPos = this.pendingKinematic.pos.clone();
                if (mesh && mesh.parent) {
                    mesh.parent.localToWorld(globalPos);
                }

                const pose = this.computePose(globalPos.x, globalPos.z);

                globalPos.y = pose.height;
                let localNormal = pose.normal.clone();

                if (mesh && mesh.parent) {
                    mesh.parent.worldToLocal(globalPos);
                    const parentWorldQuat = mesh.parent.getWorldQuaternion(new THREE.Quaternion());
                    localNormal.applyQuaternion(parentWorldQuat.invert());
                }

                this.pendingKinematic.pos.y = globalPos.y;
                this.pendingKinematic.normal = localNormal;
            }

            const body = this.entity.getPhysicsBody();
            if (body) {
                this.setLocomotionMode(body, this.pendingKinematic.mode);
            }

            const mesh = this.entity.getMesh();
            if (!mesh) return;

            mesh.position.copy(this.pendingKinematic.pos);

            const up = new THREE.Vector3(0, 1, 0);
            const normalQuaternion = new THREE.Quaternion().setFromUnitVectors(up, this.pendingKinematic.normal);
            const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(this.pendingKinematic.normal, -this.pendingKinematic.angle);

            mesh.quaternion.multiplyQuaternions(rotationQuaternion, normalQuaternion);

            this.pendingKinematic = null;
        }
    }

    /**
     * For dynamic locomotion the x-z and angle of the visuals is updated
     * from the physics. The pose (height, normal) are computed here.
     */
    public getDynamicPose(pos: planck.Vec2, angle: number): { height: number; quaternion: THREE.Quaternion } | null {
        const up = new THREE.Vector3(0, 1, 0);

        const pose = this.computePose(pos.x, pos.y);

        const normalQuaternion = new THREE.Quaternion().setFromUnitVectors(up, pose.normal);
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(pose.normal, -angle);
        const quaternion = new THREE.Quaternion().multiplyQuaternions(rotationQuaternion, normalQuaternion);

        return { height: pose.height, quaternion };
    }

    /**
     * Called after all motion updates have been applied to determine
     * whether the animal is in a new zone.
     */
    public updateZone() {
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        // Sample the terrain map at the current position to get the zone
        const { zone } = this.entity.getTerrainMap().getZone(
            worldPos.x, worldPos.z, this.marginWidth);

        if (this.currentZone !== zone) {
            this.currentZone = zone;
            this.entity.handleBehaviorEvent?.({
                type: 'ZONE_CHANGED',
                zone: zone
            });
        }
    }

    /**
     * Sets the physics body parameters to match the locomotion type.
     */
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

    /**
     * Compute the pose (height, normal) for a given x-z position.
     */
    private computePose(x: number, z: number): { height: number, normal: THREE.Vector3 } {
        const currentPos = new THREE.Vector2(x, z);
        let height = 0;
        let normal: THREE.Vector3;

        if (this.entity.currentSlot) {
            height = this.entity.currentSlot.y;
            normal = new THREE.Vector3(0, 1, 0);
        } else {
            const terrainMap = this.entity.getTerrainMap();
            const { zone, t: tau } = terrainMap.getZone(x, z, this.marginWidth);
            const sample = terrainMap.getSurfaceInfo(x, z);

            height = sample.y;
            normal = sample.normal;

            // Interpolate height and normal in the margin
            if (zone === 'margin' && tau > 0) {
                height = height * (1 - tau) + (height + this.waterHeight) * tau;

                const f = 4 * tau * (1 - tau); // Parabolic weight peaking at 0.5 (t=0.5)

                // Tilted normal: 45 degrees in direction of movement
                if (this.prevHorizontalPos) {
                    const moveDir = currentPos.clone().sub(this.prevHorizontalPos);
                    if (moveDir.lengthSq() > 0.0001) {
                        moveDir.normalize();
                        const tiltedNormal = new THREE.Vector3(moveDir.x, 1, moveDir.y).normalize();
                        normal.lerp(tiltedNormal, f).normalize();
                    }
                }
            } else if (zone === 'water') {
                height += this.waterHeight;
            }
        }

        // Jump parabolic height
        if (this.jumpActive && this.prevHorizontalPos) {
            const horizontalMoveDist = currentPos.distanceTo(this.prevHorizontalPos);
            this.jumpTraveledDistance += horizontalMoveDist;

            const t = this.jumpTraveledDistance / this.jumpScale;
            const parabolicHeight = this.jumpStartHeight + 4 * t * (1 - t) * this.jumpHeight;

            if (parabolicHeight <= height) {
                this.jumpActive = false;
            } else {
                height = parabolicHeight;
            }
        }

        return { height, normal };
    }

    /**
     * Motion parameters when not moving.
     */
    private computeNoneLocomotion(context: AnimalLogicContext) {
        const isKinematic = context.physicsBody.getType() === planck.Body.KINEMATIC;
        if (isKinematic) {
            const mesh = this.entity.getMesh();
            if (mesh) {
                this.pendingKinematic = {
                    pos: new THREE.Vector3(mesh.position.x, 0, mesh.position.z),
                    angle: this.entity.localAngle(),
                    normal: new THREE.Vector3(0, 1, 0),
                    mode: 'NONE'
                };
            }
        } else {
            this.pendingDynamic = {
                linVel: planck.Vec2(0, 0),
                angVel: 0,
                mode: 'NONE'
            };
        }
    }

    /**
     * Water motion parameters.
     */
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

    /**
     * Land motion parameters.
     */
    private computeLandLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        const { dt } = context;
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        const nextPos = mesh.position.clone();

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

        // Capture jump activation from logic result
        if (result.jump && !this.jumpActive) {
            this.jumpActive = true;
            this.jumpStartHeight = mesh.position.y;
            this.jumpHeight = result.jump.height;
            this.jumpScale = result.jump.distance;
            this.jumpTraveledDistance = 0;
        }

        this.pendingKinematic = {
            pos: nextPos,
            angle: nextAngle,
            normal: new THREE.Vector3(0, 1, 0),
            mode: 'LAND'
        };
    }

    /**
     * Flight motion parameters.
     */
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
}
