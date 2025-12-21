import { TransformNode, Vector3, AnimationGroup } from "@babylonjs/core";
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class TRex extends AttackAnimal {
    public static readonly HEIGHT_IN_WATER: number = -3.0;

    protected get heightInWater(): number {
        return TRex.HEIGHT_IN_WATER;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'trex', options, {
            halfWidth: 1.5,
            halfLength: 4.0,
            density: 10.0,
            friction: 0.1
        });
    }

    protected getModelData() {
        return Decorations.getTRex();
    }

    protected setupModel(model: TransformNode, animations: AnimationGroup[]): void {
        model.scaling.set(6.0, 6.0, 6.0);
        model.rotation.y = Math.PI;
        if (animations.length > 0) animations[0].start(true, 1.0);
    }
}
