import { TransformNode, Vector3, AnimationGroup } from "@babylonjs/core";
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { AttackAnimal, AttackAnimalOptions } from './AttackAnimal';

export class Alligator extends AttackAnimal {
    public static readonly HEIGHT_IN_WATER: number = -1.0;
    private animations: AnimationGroup[] = [];
    private currentAnimation: AnimationGroup | null = null;

    protected get heightInWater(): number {
        return Alligator.HEIGHT_IN_WATER;
    }

    constructor(
        physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions
    ) {
        super(physicsEngine, 'alligator', options, {
            halfWidth: 1.0,
            halfLength: 3.0,
            density: 5.0,
            friction: 0.1,
            linearDamping: 2.0,
            angularDamping: 1.0
        });
    }

    protected getModelData() {
        return Decorations.getAlligator();
    }

    protected setupModel(model: TransformNode, animations: AnimationGroup[]): void {
        model.scaling.set(3.0, 3.0, 3.0);
        model.rotation.y = Math.PI;
        this.animations = animations;
        this.playAnimation('Idle');
    }

    private playAnimation(name: string, loop: boolean = true) {
        const anim = this.animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
        if (anim && anim !== this.currentAnimation) {
            if (this.currentAnimation) this.currentAnimation.stop();
            this.currentAnimation = anim;
            anim.start(loop, 2.0); // Speed scale 2.0 as per getAnimationTimeScale
        }
    }

    // AI Callbacks
    waterAttackUpdateIdle() {
        this.playAnimation('Idle');
    }

    waterAttackUpdatePreparing() {
        this.playAnimation('Idle'); // Or a 'Notice' animation if exists
    }

    waterAttackUpdateAttacking() {
        this.playAnimation('Attack'); // Or 'Swim'
    }

    protected getAnimationTimeScale(): number {
        return 2.0;
    }
}
