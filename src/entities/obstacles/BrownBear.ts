import { TransformNode, Vector3, AnimationGroup } from "@babylonjs/core";
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class BrownBear extends AttackAnimal {
    public static readonly HEIGHT_IN_WATER: number = -2.0;

    protected get heightInWater(): number {
        return BrownBear.HEIGHT_IN_WATER;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'brownbear', options, {
            halfWidth: 1.5,
            halfLength: 2.5,
            density: 5.0,
            friction: 0.3,
            linearDamping: 3.0,
            angularDamping: 2.0
        });
    }

    protected getModelData() {
        return Decorations.getBrownBear();
    }

    protected setupModel(model: TransformNode, animations: AnimationGroup[]): void {
        model.scaling.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
        // Play idle
        const idle = animations.find(a => a.name.includes('Roaring') || a.name.includes('Idle'));
        if (idle) idle.start(true, 1.0);
    }

    protected getIdleAnimationName(): string {
        return 'Roaring';
    }

    protected getWalkingAnimationName(): string {
        return 'Roar+Walk';
    }
}
