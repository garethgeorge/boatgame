import * as THREE from 'three';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions, AttackBehaviorFactory } from './AttackAnimal';
import { AnimalBehaviorEvent } from '../behaviors/AnimalBehavior';
import { AnimalLogicPhase } from '../behaviors/logic/AnimalLogic';
import { AnimalAnimations } from './Animal';
import { Entity } from '../../core/Entity';

export class Hippo extends AttackAnimal {

    public static readonly HEIGHT_IN_WATER: number = -0.5;

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'hippo', Entity.TYPE_OBSTACLE, true,
            options,
            {
                halfWidth: 1.5,
                halfLength: 3.0,
                density: 5.0,
                friction: 0.1,
                linearDamping: 2.0,
                angularDamping: 1.0
            });

        this.setBehavior(AttackBehaviorFactory.create(this,
            {
                heightInWater: Hippo.HEIGHT_IN_WATER,
                ...options,
            })
        );
    }

    protected getModelData() {
        return Decorations.getHippo();
    }

    protected setupModel(model: THREE.Group): void {
        model.scale.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
        model.position.y = -0.2;
    }

    private static readonly animations: AnimalAnimations = {
        default: AttackAnimal.play({
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
                play: AttackAnimal.play({
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
                    mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, -0.5, event.dt * 2);
                    break;
                }
            }
        }
    }
}
