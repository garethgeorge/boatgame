import * as planck from 'planck';
import * as THREE from 'three';
import { Boat } from '../Boat';
import { AnyAnimal } from './AnimalBehavior';
import { EntityBehavior } from './EntityBehavior';
import { AnimalLogicContext, AnimalLogicScript } from './logic/AnimalLogic';
import { AnimalScriptPlayer } from './AnimalScriptPlayer';
import { AnimalLocomotionController } from './AnimalLocomotionController';

export class AnimalUniversalBehavior implements EntityBehavior {
    private entity: AnyAnimal;
    private aggressiveness: number;
    private snoutOffset: planck.Vec2;

    private scriptPlayer: AnimalScriptPlayer;
    private locomotionController: AnimalLocomotionController;

    constructor(
        entity: AnyAnimal,
        aggressiveness: number,
        waterHeight: number,
        script: AnimalLogicScript,
        snoutOffset?: planck.Vec2
    ) {
        this.entity = entity;
        this.aggressiveness = aggressiveness;
        this.snoutOffset = snoutOffset || planck.Vec2(0, 0);

        this.scriptPlayer = new AnimalScriptPlayer(entity, script);
        this.locomotionController = new AnimalLocomotionController(entity, waterHeight);
    }

    update(dt: number) {
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

        // 1. Run Logic Script
        const result = this.scriptPlayer.update(context);

        // 2. Execute Locomotion
        if (result) {
            this.locomotionController.computeLocomotion(context, result);
        }
    }

    updatePhysics(dt: number) {
        this.locomotionController.updatePhysics(dt);
    }

    updateVisuals(dt: number, alpha: number) {
        this.locomotionController.updateVisuals(dt);
    }

    updateSceneGraph() {
        this.locomotionController.updateZone();
    }

    getDynamicPose(pos: planck.Vec2, angle: number): { height: number; quaternion: THREE.Quaternion } | null {
        return this.locomotionController.getDynamicPose(pos, angle);
    }
}
