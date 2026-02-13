import * as planck from 'planck';
import * as THREE from 'three';
import { Boat } from '../Boat';
import { AnyAnimal } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalBehaviorUtils } from './AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase, AnimalLogicScript, AnimalLogicScriptFn } from './logic/AnimalLogic';
import { LocomotionType } from './logic/strategy/AnimalPathStrategy';
import { AnimalLogicConfig } from './logic/AnimalLogicConfigs';
import { AnimalLogicRegistry } from './logic/AnimalLogicRegistry';
import { RiverSystem } from '../../world/RiverSystem';

interface ScriptStackEntry {
    script: AnimalLogicScriptFn;
    step: number;
}

export class AnimalUniversalBehavior implements EntityBehavior {
    private entity: AnyAnimal;
    private aggressiveness: number;
    private waterHeight: number;
    private snoutOffset: planck.Vec2;

    // Script execution
    private scriptStack: ScriptStackEntry[] = [];
    private nextLogicConfig: AnimalLogicConfig = null;
    private logic: AnimalLogic = null;
    private logicTimeout: number | undefined = undefined;

    // Logic State
    private logicPhase: AnimalLogicPhase = AnimalLogicPhase.NONE;

    // Flight/Land state tracking
    private currentAngle: number = 0;
    private currentBank: number = 0;
    private isKinematic: boolean = false;
    private pendingKinematic: {
        pos: THREE.Vector3, angle: number, normal: THREE.Vector3, bank: number
    } | null = null;
    private pendingDynamic: {
        linVel: planck.Vec2, angVel: number, height?: number, normal?: THREE.Vector3
    } | null = null;

    // Jump state
    private jumpActive: boolean = false;
    private jumpStartHeight: number = 0;
    private jumpHeight: number = 0;
    private jumpScale: number = 0;
    private jumpTraveledDistance: number = 0;

    // Dynamics Constants
    private readonly VERT_SPEED: number = 10.0;
    private readonly ROTATION_SPEED_FLIGHT: number = Math.PI * 1.0;
    private readonly BANK_SPEED = Math.PI * 1.5;
    private readonly MAX_BANK = Math.PI * 0.3;

    constructor(
        entity: AnyAnimal,
        aggressiveness: number,
        waterHeight: number,
        script: AnimalLogicScript,
        snoutOffset?: planck.Vec2
    ) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
        this.waterHeight = waterHeight;
        this.snoutOffset = snoutOffset || planck.Vec2(0, 0);

        const body = entity.getPhysicsBody();
        if (body) {
            this.currentAngle = body.getAngle();
            this.isKinematic = body.getType() === planck.Body.KINEMATIC;
        }

        // Initialize script
        this.nextLogicConfig = this.beginScript(script, '');
    }

    private beginScript(script: AnimalLogicScript, lastResult: string): AnimalLogicConfig {
        if (!script) return null;

        if (typeof script === 'function') {
            this.scriptStack.push({ script, step: 0 });
            return this.resolveNextLogic('');
        } else {
            // It's a single config, treat as immediate next logic
            return script as AnimalLogicConfig;
        }
    }

    /**
     * Gets the next logic config to execute given the result from the last
     * one. The result is propogate both up and down the stack.
     */
    private resolveNextLogic(lastResult: string): AnimalLogicConfig {
        // Loop until we find a config or run out of stack
        while (this.scriptStack.length > 0) {
            const entry = this.scriptStack[this.scriptStack.length - 1];
            const nextThing = entry.script(entry.step, lastResult);

            if (!nextThing) {
                this.scriptStack.pop();
                continue;
            }

            // Increment step for next time
            entry.step++;

            if (typeof nextThing === 'function') {
                // Nested script
                this.scriptStack.push({ script: nextThing, step: 0 });
                continue;
            } else {
                // Found a config
                return nextThing as AnimalLogicConfig;
            }
        }

        // If stack empty, no logic
        return null;
    }

    update(dt: number) {
        if (!this.logic && !this.nextLogicConfig) return;

        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();
        if (!targetBody || !physicsBody) return;

        const context: AnimalLogicContext = {
            dt,
            animal: this.entity,
            originPos: physicsBody.getPosition(),
            snoutPos: physicsBody.getWorldPoint(this.snoutOffset),
            currentHeight: this.entity.getHeight(),
            physicsBody,
            targetBody,
            aggressiveness: this.aggressiveness,
            bottles: Boat.getBottleCount()
        };

        // Create and activate next logic if needed
        if (this.nextLogicConfig) {
            this.activateLogic(context, this.nextLogicConfig);
            this.nextLogicConfig = null;
        }

        this.updateLogic(context);
    }

    private activateLogic(context: AnimalLogicContext, config: AnimalLogicConfig) {
        if (!config) {
            this.logic = null;
            return;
        }

        this.logic = AnimalLogicRegistry.create(config);
        if (!this.logic) return;

        this.logic.activate(context);
        this.logicTimeout = config.timeout;
    }

    private updateLogic(context: AnimalLogicContext) {
        if (!this.logic) return;

        // Update current logic
        let result = this.logic.update(context);

        // Check timeout
        if (this.logicTimeout !== undefined) {
            this.logicTimeout -= context.dt;
            if (this.logicTimeout <= 0.0) {
                result.result = 'TIMEOUT';
                result.finish = false;
            }
        }

        // Handle immediate chaining
        while (result.result && (result.finish === undefined || !result.finish)) {
            const nextConfig = this.resolveNextLogic(result.result);
            this.activateLogic(context, nextConfig);
            if (this.logic) {
                result = this.logic.update(context);
            } else {
                this.dispatchFinishedEvent();
                return;
            }
        }

        // Events relative to current (possibly new) logic
        if (this.logic) {
            this.dispatchEvents(this.logic, context);
        }

        // Compute Locomotion (do not apply)
        this.computeLocomotion(context, result);

        // Handle deferred chaining
        if (result.result && (result.finish !== undefined || result.finish)) {
            this.nextLogicConfig = this.resolveNextLogic(result.result);
            this.logic = null;
            if (!this.nextLogicConfig) {
                this.dispatchFinishedEvent();
                return;
            }
        }
    }

    apply(dt: number) {
        if (this.pendingKinematic) {
            this.applyKinematicUpdate(this.pendingKinematic);
            this.pendingKinematic = null;
        } else if (this.pendingDynamic) {
            this.applyDynamicUpdate(this.pendingDynamic);
            this.pendingDynamic = null;
        }
    }

    private computeLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        if (!result || !result.path) return;

        // Reset jump if not in LAND locomotion or if jump is not provided by the logic
        // and we are not currently jumping
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
    }

    private dispatchEvents(logic: AnimalLogic, context: AnimalLogicContext) {
        const logicPhase = logic.getPhase();
        if (this.logicPhase !== logicPhase) {
            this.entity.handleBehaviorEvent?.({
                type: 'LOGIC_STARTING',
                logic: logic,
                logicPhase: logicPhase
            });
            this.logicPhase = logicPhase;
        }
        this.entity.handleBehaviorEvent?.({
            type: 'LOGIC_TICK',
            dt: context.dt,
            logic: logic,
            logicPhase: logicPhase
        });
    }

    private dispatchFinishedEvent() {
        this.entity.handleBehaviorEvent?.({
            type: 'LOGIC_FINISHED'
        });
        this.logicPhase = AnimalLogicPhase.NONE;
    }

    private applyKinematicUpdate(update: {
        pos: THREE.Vector3, angle: number, normal: THREE.Vector3, bank: number
    }) {
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        mesh.position.copy(update.pos);

        const up = new THREE.Vector3(0, 1, 0);
        const normalQuaternion = new THREE.Quaternion().setFromUnitVectors(up, update.normal);
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(update.normal, -update.angle);

        mesh.quaternion.multiplyQuaternions(rotationQuaternion, normalQuaternion);
    }

    private applyDynamicUpdate(update: {
        linVel: planck.Vec2, angVel: number, height?: number, normal?: THREE.Vector3
    }) {
        const body = this.entity.getPhysicsBody();
        if (!body) return;

        body.setLinearVelocity(update.linVel);
        body.setAngularVelocity(update.angVel);

        if (update.height !== undefined && update.normal) {
            this.entity.setDynamicPosition(update.height, update.normal);
        }
    }

    private setPhysicsMode(body: planck.Body, kinematic: boolean) {
        if (kinematic && !this.isKinematic) {
            AnimalBehaviorUtils.setCollisionMask(body, 0);
            body.setType(planck.Body.KINEMATIC);

            // We are driving position directly
            body.setLinearVelocity(planck.Vec2(0, 0));
            body.setAngularVelocity(0);

            //maybe do this.. better is supply some velocity
            //body.setSleepingAllowed(false);

            this.isKinematic = true;
        } else if (!kinematic && this.isKinematic) {
            AnimalBehaviorUtils.setCollisionMask(body, 0xFFFF);
            body.setType(planck.Body.DYNAMIC);
            this.isKinematic = false;
        }
    }

    private computeWaterLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        this.setPhysicsMode(context.physicsBody, false);

        const steering = result.path;
        const { physicsBody, originPos, dt } = context;
        const targetWorldPos = steering.target;
        const desiredSpeed = steering.speed;

        const turnSpeed = steering.turningSpeed ?? Math.PI;
        const turnSmoothing = steering.turningSmoothing ?? 5.0;

        const originToTarget = targetWorldPos.clone().sub(originPos);
        const originToTargetDist = originToTarget.length();

        // --- Rotation ---
        const desiredAngle = Math.atan2(originToTarget.x, -originToTarget.y);
        const currentAngle = physicsBody.getAngle();

        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const taper = Math.min(Math.abs(angleDiff) * 3.0, 1.0);
        const targetRotationSpeed = Math.sign(angleDiff) * turnSpeed * taper;
        const finalRotationSpeed = physicsBody.getAngularVelocity() + (targetRotationSpeed - physicsBody.getAngularVelocity()) * Math.min(1.0, turnSmoothing * dt * 60);

        // --- Movement ---
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
            height: this.waterHeight,
            normal: new THREE.Vector3(0, 1, 0)
        };
    }

    private computeLandLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        this.setPhysicsMode(context.physicsBody, true);
        const { dt, originPos, physicsBody } = context;
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        const nextPos = mesh.position.clone();
        const prevHorizontalPos = new THREE.Vector2(nextPos.x, nextPos.z);

        // Handle Steering Path (Kinematic Movement)
        const steering = result.path;
        const targetWorldPos = steering.target;
        const desiredSpeed = steering.speed;

        const parent = this.entity.parent();
        const targetRelativePos = this.getRelativePosition(targetWorldPos, parent);

        // --- Movement ---
        const moveVec = targetRelativePos.clone().sub(new THREE.Vector2(nextPos.x, nextPos.z));
        const distToTarget = moveVec.length();

        if (distToTarget > 0.01) {
            const moveDist = Math.min(distToTarget, desiredSpeed * dt);
            const moveDir = moveVec.clone().normalize();
            nextPos.x += moveDir.x * moveDist;
            nextPos.z += moveDir.y * moveDist;
        }

        // --- Rotation ---
        let targetAngle = this.currentAngle;
        if (distToTarget > 0.1) {
            targetAngle = Math.atan2(moveVec.x, -moveVec.y); // Forward is -Z
        }

        let angleDiff = targetAngle - this.currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const rotationSpeed = steering.turningSpeed ?? 3.0;
        const maxRotation = rotationSpeed * dt;
        const rotation = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxRotation);
        const nextAngle = this.currentAngle + rotation;

        const worldPos = this.getWorldPosition(nextPos, parent);
        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(worldPos.x, worldPos.z);
        const terrainNormal = RiverSystem.getInstance().terrainGeometry.calculateNormal(worldPos.x, worldPos.z);

        const banks = RiverSystem.getInstance().getBankPositions(worldPos.z);
        let normalHeight = terrainHeight;
        if (worldPos.x > banks.left && worldPos.x < banks.right) {
            const distFromBank = Math.min(Math.abs(worldPos.x - banks.left), Math.abs(worldPos.x - banks.right));
            const t = Math.min(1.0, distFromBank / 2.0);
            normalHeight = terrainHeight * (1 - t) + this.waterHeight * t;
        }

        // --- Jump Logic ---
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
            // height = start jump height + 4 * t * (1-t) * jump height
            const parabolicHeight = this.jumpStartHeight + 4 * t * (1 - t) * this.jumpHeight;

            if (parabolicHeight <= normalHeight) {
                this.jumpActive = false;
                nextPos.y = normalHeight;
            } else {
                nextPos.y = parabolicHeight;
            }
        } else {
            nextPos.y = normalHeight;
        }

        this.pendingKinematic = {
            pos: nextPos,
            angle: nextAngle,
            normal: terrainNormal,
            bank: 0
        };
        this.currentAngle = nextAngle;
    }

    private computeFlightLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        this.setPhysicsMode(context.physicsBody, true);
        const { dt, originPos, physicsBody } = context;
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        const nextPos = mesh.position.clone();

        const steering = result.path;
        const targetWorldPos = steering.target;
        const desiredSpeed = steering.speed;
        const desiredHeight = steering.height ?? context.currentHeight;

        // --- Rotation and Banking ---
        const parent = this.entity.parent();
        const targetRelativePos = this.getRelativePosition(targetWorldPos, parent);
        const moveVec = targetRelativePos.clone().sub(new THREE.Vector2(nextPos.x, nextPos.z));
        const distToTarget = moveVec.length();

        const targetAngle = Math.atan2(moveVec.x, -moveVec.y);

        const turnSpeed = steering.turningSpeed ?? this.ROTATION_SPEED_FLIGHT;
        this.handleFlightRotationAndBanking(targetAngle, turnSpeed, dt);

        // --- Horizontal Movement ---
        if (distToTarget > 0.01) {
            const moveDist = Math.min(distToTarget, desiredSpeed * dt);
            const moveDir = moveVec.clone().normalize();
            nextPos.x += moveDir.x * moveDist;
            nextPos.z += moveDir.y * moveDist;
        }

        // --- Height ---
        const currentHeight = context.currentHeight;
        let newHeight = currentHeight;
        if (currentHeight < desiredHeight) {
            newHeight = Math.min(desiredHeight, currentHeight + this.VERT_SPEED * dt);
        } else if (currentHeight > desiredHeight) {
            newHeight = Math.max(desiredHeight, currentHeight - this.VERT_SPEED * dt);
        }
        nextPos.y = newHeight;

        // --- Normal (Banking) ---
        let normal = new THREE.Vector3(0, 1, 0);
        const bankingEnabled = steering.bankingEnabled ?? true;
        if (bankingEnabled) {
            normal = this.getBankingNormal();
        }

        this.pendingKinematic = {
            pos: nextPos,
            angle: this.currentAngle,
            normal: normal,
            bank: this.currentBank
        };
    }

    private handleFlightRotationAndBanking(targetAngle: number, turnSpeed: number, dt: number) {
        let diff = targetAngle - this.currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const maxRotation = turnSpeed * dt;
        const turnDirection = Math.sign(diff);

        if (Math.abs(diff) < maxRotation) {
            this.currentAngle = targetAngle;
        } else {
            this.currentAngle += turnDirection * maxRotation;
        }

        while (this.currentAngle > Math.PI) this.currentAngle -= Math.PI * 2;
        while (this.currentAngle < -Math.PI) this.currentAngle += Math.PI * 2;

        const targetIntensity = Math.min(1.0, Math.abs(diff) / (Math.PI / 4));
        const targetBank = turnDirection * targetIntensity * this.MAX_BANK;
        const bankDiff = targetBank - this.currentBank;
        const maxBankChange = this.BANK_SPEED * dt;

        if (Math.abs(bankDiff) < maxBankChange) {
            this.currentBank = targetBank;
        } else {
            this.currentBank += Math.sign(bankDiff) * maxBankChange;
        }
    }

    private getBankingNormal(): THREE.Vector3 {
        const right = new THREE.Vector3(Math.cos(this.currentAngle), 0, Math.sin(this.currentAngle));
        const up = new THREE.Vector3(0, 1, 0);

        return up.multiplyScalar(Math.cos(this.currentBank))
            .add(right.multiplyScalar(Math.sin(this.currentBank)))
            .normalize();

    }

    private computeNoneLocomotion(context: AnimalLogicContext) {
        if (this.isKinematic) {
            // Keep current kinematic state (no updates to pendingKinematic)
            this.pendingKinematic = null;
        } else {
            // Stop dynamic motion but DO NOT override height or normal
            // this allows the animal to stay at its current height
            this.pendingDynamic = {
                linVel: planck.Vec2(0, 0),
                angVel: 0
            };
        }
    }

    private getRelativePosition(worldPos: planck.Vec2, parent: any | null): THREE.Vector2 {
        if (parent && parent.meshes.length > 0) {
            const parentMesh = parent.meshes[0];
            const localPos = new THREE.Vector3(worldPos.x, 0, worldPos.y);
            parentMesh.worldToLocal(localPos);
            return new THREE.Vector2(localPos.x, localPos.z);
        }
        return new THREE.Vector2(worldPos.x, worldPos.y);
    }

    private getWorldPosition(localPos: THREE.Vector3, parent: any | null): THREE.Vector3 {
        if (parent && parent.meshes.length > 0) {
            const parentMesh = parent.meshes[0];
            return localPos.clone().applyMatrix4(parentMesh.matrixWorld);
        }
        return localPos.clone();
    }
}
