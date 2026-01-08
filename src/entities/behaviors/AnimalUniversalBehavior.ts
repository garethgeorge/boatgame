import * as planck from 'planck';
import * as THREE from 'three';
import { Boat } from '../Boat';
import { AnyAnimal } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalBehaviorUtils } from './AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig } from './logic/AnimalLogic';
import { AnimalLogicRegistry } from './logic/AnimalLogicRegistry';
import { AnimalBehaviorEvent } from './AnimalBehavior';

export class AnimalUniversalBehavior implements EntityBehavior {
    private entity: AnyAnimal;
    private logic: AnimalLogic;
    private state: 'IDLE' | 'ACTIVE' = 'IDLE';
    private aggressiveness: number;
    private snoutOffset: planck.Vec2;

    // Flight/Land state tracking
    private currentAngle: number = 0;
    private currentBank: number = 0;
    private isKinematic: boolean = false;

    // Dynamics Constants
    private readonly VERT_SPEED: number = 10.0;
    private readonly ROTATION_SPEED_FLIGHT: number = Math.PI * 1.0;
    private readonly BANK_SPEED = Math.PI * 1.5;
    private readonly MAX_BANK = Math.PI * 0.15;

    constructor(
        entity: AnyAnimal,
        aggressiveness: number,
        logicConfig: AnimalLogicConfig,
        snoutOffset?: planck.Vec2
    ) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
        this.logic = AnimalLogicRegistry.create(logicConfig);
        this.snoutOffset = snoutOffset || planck.Vec2(0, 0);

        const body = entity.getPhysicsBody();
        if (body) {
            this.currentAngle = body.getAngle();
        }
    }

    update(dt: number) {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();
        if (!targetBody || !physicsBody) return;

        const context: AnimalLogicContext = {
            dt,
            originPos: physicsBody.getPosition(),
            snoutPos: physicsBody.getWorldPoint(this.snoutOffset),
            currentHeight: this.entity.getHeight(),
            physicsBody,
            targetBody,
            aggressiveness: this.aggressiveness,
            bottles: Boat.getBottleCount()
        };

        switch (this.state) {
            case 'IDLE':
                this.updateIdle(context);
                break;
            case 'ACTIVE':
                this.updateActive(context);
                break;
        }
    }

    private updateIdle(context: AnimalLogicContext) {
        // Shared idle animation (if entity supports it)
        this.entity.handleBehaviorEvent?.({ type: 'IDLE_TICK', dt: context.dt });

        if (this.logic.shouldActivate(context)) {
            this.state = 'ACTIVE';

            const duration = this.logic.getEstimatedDuration?.(context);
            this.entity.handleBehaviorEvent?.({
                type: 'LOGIC_STARTING', logicName: this.logic.name, duration
            });
        }
    }

    private updateActive(context: AnimalLogicContext) {
        // 1. Broad deactivation check (distance, etc)
        if (this.logic.shouldDeactivate(context)) {
            this.deactivate(context);
            return;
        }

        // 2. Internal Logic Update (timers, state transitions)
        this.logic.update(context);

        // 3. Calculate Path based on fresh state
        let result = this.logic.calculatePath(context);

        // 4. Handle Logic Chaining
        if (result.nextLogicConfig) {
            // Transfer to next logic
            const nextLogic = AnimalLogicRegistry.create(result.nextLogicConfig);

            // Notify completion of previous logic
            this.entity.handleBehaviorEvent?.({
                type: 'LOGIC_COMPLETED', logicName: this.logic.name
            });

            this.logic = nextLogic;

            // Update immediately with new logic to avoid stutter
            this.logic.update(context);
            result = this.logic.calculatePath(context);

            const duration = this.logic.getEstimatedDuration?.(context);
            this.entity.handleBehaviorEvent?.({
                type: 'LOGIC_STARTING', logicName: this.logic.name, duration
            });
        }

        // 5. Check for logic-driven completion
        if (result.isFinished) {
            this.deactivate(context);
            return;
        }

        // 6. Animations
        this.handleAnimations(context, result);

        // 7. Locomotion
        switch (result.locomotionType) {
            case 'FLIGHT':
                this.executeFlightLocomotion(context, result);
                break;
            case 'LAND':
                this.executeLandLocomotion(context, result);
                break;
            case 'WATER':
            default:
                this.executeWaterLocomotion(context, result);
                break;
        }
    }

    private deactivate(context: AnimalLogicContext) {
        this.state = 'IDLE';
        const wasKinematic = this.isKinematic;
        this.setPhysicsMode(context.physicsBody, false);
        context.physicsBody.setLinearVelocity(context.physicsBody.getLinearVelocity().mul(0.95));

        if (wasKinematic) {
            this.entity.handleBehaviorEvent?.({ type: 'COMPLETED' });
        }
    }

    private handleAnimations(context: AnimalLogicContext, result: AnimalLogicPathResult) {
        const state = result.animationState;

        if (this.logic.isPreparing?.()) {
            this.entity.handleBehaviorEvent?.({
                type: 'PREPARING_TICK',
                dt: context.dt
            });
        } else {
            this.entity.handleBehaviorEvent?.({
                type: 'ACTIVE_TICK',
                dt: context.dt,
                animationState: state
            });
        }
    }

    private setPhysicsMode(body: planck.Body, kinematic: boolean) {
        if (kinematic && !this.isKinematic) {
            AnimalBehaviorUtils.setCollisionMask(body, 0);
            body.setType(planck.Body.KINEMATIC);
            this.isKinematic = true;
        } else if (!kinematic && this.isKinematic) {
            AnimalBehaviorUtils.setCollisionMask(body, 0xFFFF);
            body.setType(planck.Body.DYNAMIC);
            this.isKinematic = false;
        }
    }

    private executeWaterLocomotion(context: AnimalLogicContext, path: AnimalLogicPathResult) {
        this.setPhysicsMode(context.physicsBody, false);
        const { physicsBody, originPos, dt } = context;
        const { targetWorldPos, desiredSpeed } = path;
        const turnSpeed = path.turningSpeed ?? Math.PI;
        const turnSmoothing = path.turningSmoothing ?? 5.0;

        const originToTarget = targetWorldPos.clone().sub(originPos);
        const originToTargetDist = originToTarget.length();

        // --- Rotation ---
        const desiredAngle = Math.atan2(originToTarget.y, originToTarget.x) + Math.PI / 2;
        const currentAngle = physicsBody.getAngle();

        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const taper = Math.min(Math.abs(angleDiff) * 3.0, 1.0);
        const targetRotationSpeed = Math.sign(angleDiff) * turnSpeed * taper;
        const finalRotationSpeed = physicsBody.getAngularVelocity() + (targetRotationSpeed - physicsBody.getAngularVelocity()) * Math.min(1.0, turnSmoothing * dt * 60);
        physicsBody.setAngularVelocity(finalRotationSpeed);

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

        physicsBody.setLinearVelocity(nextVel);
    }

    private executeLandLocomotion(context: AnimalLogicContext, path: AnimalLogicPathResult) {
        this.setPhysicsMode(context.physicsBody, true);
        const { dt, physicsBody, originPos } = context;
        const { targetWorldPos, desiredSpeed, explicitHeight, explicitNormal } = path;

        // --- Movement ---
        const originToTarget = targetWorldPos.clone().sub(originPos);
        const originToTargetDist = originToTarget.length();
        if (originToTargetDist > 0.01) {
            const moveDir = originToTarget.clone().mul(1.0 / originToTargetDist);
            const moveVel = moveDir.mul(desiredSpeed);
            physicsBody.setLinearVelocity(moveVel);
        } else {
            physicsBody.setLinearVelocity(planck.Vec2(0, 0));
        }

        // --- Rotation ---
        // Simple rotation towards target
        if (originToTargetDist > 0.1) {
            const targetAngle = Math.atan2(originToTarget.y, originToTarget.x) + Math.PI / 2;
            physicsBody.setAngle(targetAngle);
        }

        // --- Precise Positioning (Height/Normal) ---
        if (explicitHeight !== undefined && explicitNormal !== undefined) {
            this.entity.setExplictPosition?.(explicitHeight, explicitNormal);
        }
    }

    private executeFlightLocomotion(context: AnimalLogicContext, path: AnimalLogicPathResult) {
        this.setPhysicsMode(context.physicsBody, true);
        const { dt, physicsBody, originPos } = context;
        const { targetWorldPos, desiredHeight, desiredSpeed } = path;

        // --- Rotation and Banking ---
        const diffToTarget = targetWorldPos.clone().sub(originPos);
        const targetAngle = Math.atan2(diffToTarget.x, -diffToTarget.y);

        this.handleFlightRotationAndBanking(targetAngle, dt);
        physicsBody.setAngle(this.currentAngle);

        // --- Horizontal Movement ---
        const flightDir = planck.Vec2(Math.sin(this.currentAngle), -Math.cos(this.currentAngle));
        const newPos = originPos.clone().add(flightDir.mul(desiredSpeed * dt));
        physicsBody.setPosition(newPos);

        // --- Height ---
        const currentHeight = context.currentHeight;
        let newHeight = currentHeight;
        if (currentHeight < desiredHeight) {
            newHeight = Math.min(desiredHeight, currentHeight + this.VERT_SPEED * dt);
        } else if (currentHeight > desiredHeight) {
            newHeight = Math.max(desiredHeight, currentHeight - this.VERT_SPEED * dt);
        }

        this.entity.setExplictPosition?.(newHeight, this.getBankingNormal());
    }

    private handleFlightRotationAndBanking(targetAngle: number, dt: number) {
        let diff = targetAngle - this.currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const maxRotation = this.ROTATION_SPEED_FLIGHT * dt;
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
}
