import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { ObstacleHitBehaviorParams } from '../behaviors/ObstacleHitBehavior';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { Animal, AnimalOptions, AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';
import { AttackBehaviorFactory } from '../behaviors/AttackBehaviorFactory';

import { EntityMetadata } from '../EntityMetadata';

export class Hippo extends Animal {

    public static readonly HEIGHT_IN_WATER: number = -0.5;
    public static readonly MODEL_PARAMS = { scale: 3.0, angle: Math.PI };
    public static readonly RADIUS: number = EntityMetadata.hippo.radius;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AnimalOptions
    ) {
        super(physicsEngine, 'hippo', Entity.TYPE_OBSTACLE, true,
            options,
            {
                hull: EntityMetadata.hippo.hull,
                density: 5.0,
                friction: 0.1,
                linearDamping: 2.0,
                angularDamping: 1.0
            });

        this.setBehavior(AttackBehaviorFactory.create(this,
            {
                heightInWater: Hippo.HEIGHT_IN_WATER,
                jumpsIntoWater: false,
                snoutOffset: 3.0,
                ...options,
            })
        );
    }

    protected override getHitBehaviorParams(): ObstacleHitBehaviorParams {
        return { duration: 0.5, rotateSpeed: 0, targetHeightOffset: -2 };
    }

    protected getModelData() {
        return Decorations.getHippo();
    }

    protected setupModel(model: THREE.Group): void {
        const { scale, angle } = Hippo.MODEL_PARAMS;
        model.scale.set(scale, scale, scale);
        if (angle !== undefined) model.rotation.y = angle;
        model.position.y = -0.2;
    }

    private static readonly animations: AnimalAnimations = {
        default: Animal.play({
            name: 'swimming',
            timeScale: 2.0, startTime: -1, randomizeLength: 0.2,
            repeat: Infinity
        }),
        animations: [
            {
                phases: [
                    AnimalLogicPhase.ENTERING_WATER,
                    AnimalLogicPhase.PREPARING_ATTACK,
                    AnimalLogicPhase.ATTACKING,
                ],
                play: Animal.play({
                    name: 'swimming',
                    timeScale: 2.0, startTime: -1, randomizeLength: 0.2,
                    repeat: Infinity
                })
            },
        ]
    }

    protected getAnimations(): AnimalAnimations {
        return Hippo.animations;
    }

    handleBehaviorEvent(event: AnimalBehaviorEvent): void {
        super.handleBehaviorEvent(event);

        if (this.meshes.length === 0) return;
        const mesh = this.meshes[0];

        if (event.type === 'LOGIC_TICK') {
            switch (event.logicPhase) {
                case AnimalLogicPhase.PREPARING_ATTACK: {
                    // Shake effect only, no tilt
                    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, event.dt * 10);

                    // Smooth wobble instead of random shake
                    const time = Date.now() / 50; // Speed of wobble
                    const wobbleAmount = 0.05; // Amplitude
                    mesh.rotation.z = Math.sin(time) * wobbleAmount;

                    // Float up to 0.8
                    mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.8, event.dt * 2);
                    break;
                }
                case AnimalLogicPhase.ATTACKING: {
                    // Ensure at surface
                    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, event.dt * 10);
                    mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, event.dt * 10);
                    mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.8, event.dt * 5);
                    break;
                }
                default: {
                    // Sit lower in water
                    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, event.dt * 5);
                    mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, event.dt * 5);
                    mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, Hippo.HEIGHT_IN_WATER, event.dt * 2);
                    break;
                }
            }
        }
    }
}
