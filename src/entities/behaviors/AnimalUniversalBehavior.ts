import * as planck from 'planck';
import * as THREE from 'three';
import { Boat } from '../Boat';
import { AnyAnimal } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase, AnimalLogicScript, AnimalLogicScriptFn } from './logic/AnimalLogic';
import { AnimalLogicConfig } from './logic/AnimalLogicConfigs';
import { AnimalLogicRegistry } from './logic/AnimalLogicRegistry';
import { RiverSystem } from '../../world/RiverSystem';
import { PhysicsUtils } from '../../core/PhysicsUtils';

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
    private currentBank: number = 0;

    private pendingKinematic: {
        pos: THREE.Vector3, angle: number, normal: THREE.Vector3
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

        // Initialize script
        this.nextLogicConfig = this.beginScript(script, '');
    }

    public getWaterHeight(): number {
        return this.waterHeight;
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

        const worldPos = this.entity.localPos().clone();
        this.entity.localToWorldPos(worldPos);

        const context: AnimalLogicContext = {
            dt,
            animal: this.entity,
            originPos: physicsBody.getPosition(),
            snoutPos: physicsBody.getWorldPoint(this.snoutOffset),
            currentHeight: worldPos.y,
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
        pos: THREE.Vector3, angle: number, normal: THREE.Vector3
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
        const isKinematic = body.getType() === planck.Body.KINEMATIC;
        if (kinematic && !isKinematic) {
            PhysicsUtils.setCollisionMask(body, 0);
            body.setType(planck.Body.KINEMATIC);

            // We are driving position directly
            body.setLinearVelocity(planck.Vec2(0, 0));
            body.setAngularVelocity(0);

            //maybe do this.. better is supply some velocity
            //body.setSleepingAllowed(false);
        } else if (!kinematic && isKinematic) {
            PhysicsUtils.setCollisionMask(body, 0xFFFF);
            body.setType(planck.Body.DYNAMIC);
        }
    }

    private computeNoneLocomotion(context: AnimalLogicContext) {
        const isKinematic = context.physicsBody.getType() === planck.Body.KINEMATIC;
        if (isKinematic) {
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
        const targetLocalPos = new THREE.Vector3(steering.target.x, 0, steering.target.y);
        this.entity.worldToLocalPos(targetLocalPos);
        const desiredSpeed = steering.speed;

        // --- Movement ---
        const moveVec = targetLocalPos.clone().sub(nextPos);
        const distToTarget = new THREE.Vector2(moveVec.x, moveVec.z).length();

        if (distToTarget > 0.01) {
            const moveDist = Math.min(distToTarget, desiredSpeed * dt);
            const moveDir = new THREE.Vector2(moveVec.x, moveVec.z).normalize();
            nextPos.x += moveDir.x * moveDist;
            nextPos.z += moveDir.y * moveDist;
        }

        // --- Rotation ---
        const currentAngle = this.entity.localAngle();
        let targetAngle = currentAngle;
        if (distToTarget > 0.1) {
            targetAngle = Math.atan2(moveVec.x, -moveVec.z); // Forward is -Z
        }

        let angleDiff = targetAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const rotationSpeed = steering.turningSpeed ?? 3.0;
        const maxRotation = rotationSpeed * dt;
        const rotation = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxRotation);
        const nextAngle = currentAngle + rotation;

        const { y: terrainHeight, normal: terrainNormal } =
            this.entity.getTerrainMap().sample(nextPos.x, nextPos.z, this.waterHeight, 2.0);

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
        };
    }

    private computeFlightLocomotion(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        this.setPhysicsMode(context.physicsBody, true);
        const { dt, originPos, physicsBody } = context;
        const mesh = this.entity.getMesh();
        if (!mesh) return;

        const nextPos = mesh.position.clone();

        const steering = result.path;
        const targetWorldPos = new THREE.Vector3(
            steering.target.x, steering.height ?? context.currentHeight, steering.target.y);
        const desiredSpeed = steering.speed;

        // --- Rotation and Banking ---
        const moveVec = targetWorldPos.clone().sub(nextPos);
        const distToTarget = new THREE.Vector2(moveVec.x, moveVec.z).length();

        const currentAngle = this.entity.localAngle();
        const targetAngle = Math.atan2(moveVec.x, -moveVec.z);

        const turnSpeed = steering.turningSpeed ?? this.ROTATION_SPEED_FLIGHT;
        const { nextAngle, nextBank } = this.handleFlightRotationAndBanking(
            currentAngle, this.currentBank, targetAngle, turnSpeed, dt);
        this.currentBank = nextBank;

        // --- Horizontal Movement ---
        if (distToTarget > 0.01) {
            const moveDist = Math.min(distToTarget, desiredSpeed * dt);
            const moveDir = new THREE.Vector2(moveVec.x, moveVec.z).normalize();
            nextPos.x += moveDir.x * moveDist;
            nextPos.z += moveDir.y * moveDist;
        }

        // --- Height ---
        const currentHeight = context.currentHeight;
        let newHeight = currentHeight;
        if (currentHeight < targetWorldPos.y) {
            newHeight = Math.min(targetWorldPos.y, currentHeight + this.VERT_SPEED * dt);
        } else if (currentHeight > targetWorldPos.y) {
            newHeight = Math.max(targetWorldPos.y, currentHeight - this.VERT_SPEED * dt);
        }
        nextPos.y = newHeight;

        // --- Normal (Banking) ---
        let normal = new THREE.Vector3(0, 1, 0);
        const bankingEnabled = steering.bankingEnabled ?? true;
        if (bankingEnabled) {
            normal = this.getBankingNormal(nextAngle, nextBank);
        }

        this.pendingKinematic = {
            pos: nextPos,
            angle: nextAngle,
            normal: normal
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
