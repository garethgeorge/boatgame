import {
    MeshBuilder,
    StandardMaterial,
    Color3,
    TransformNode,
    Mesh,
    Animation,
    AnimationGroup,
    Vector3,
    Quaternion,
    Curve3
} from '@babylonjs/core';
import { DecorationFactory } from './DecorationFactory';

export class BottleFactory implements DecorationFactory {
    private cache: Map<number, TransformNode> = new Map();
    // In Babylon, animations are usually created per instance or targeted.
    // We can store templates (Animation objects) and clone them? 
    // Or just recreate them since they are lightweight config.
    // Storing AnimationGroups without targets is not really a thing, they are collections of targeted animations.
    // We will create animations on demand for the target.

    async load(): Promise<void> {
        // Pre-generation not strictly needed for procedural meshes, but we can cache templates.
        // We'll lazy load in create().
    }

    create(color: number | { color: number }): TransformNode {
        // Handle input format
        const actualColor = (typeof color === 'object') ? (color as any).color : color;

        // We don't cache instances, we cache templates (maybe). 
        // Babylon meshes are cloned.
        // But for procedural, just building it is fine.
        return this.createBottleMesh(actualColor);
    }

    createAnimation(name: string, options?: any): AnimationGroup {
        const target = options?.target as TransformNode;
        if (!target) {
            throw new Error("Animation requires a target mesh in options");
        }

        switch (name) {
            case 'fade':
                return this.createFadeAnimation(target);
            case 'drop':
                return this.createDropAnimation(target);
            case 'arc-left':
                return this.createArcAnimation(target, -1);
            case 'arc-right':
                return this.createArcAnimation(target, 1);
            default:
                throw new Error(`Unknown animation ${name}`);
        }
    }

    private createBottleMesh(colorHex: number): TransformNode {
        const root = new TransformNode("bottleRoot");

        // Convert hex to Color3
        const r = ((colorHex >> 16) & 255) / 255;
        const g = ((colorHex >> 8) & 255) / 255;
        const b = (colorHex & 255) / 255;
        const color = new Color3(r, g, b);

        // Glass Material
        const glassMat = new StandardMaterial("glassMat");
        glassMat.diffuseColor = color;
        glassMat.alpha = 0.6;
        glassMat.transparencyMode = 2; // ALPHA_BLEND

        // Bottle Body
        const body = MeshBuilder.CreateCylinder("body", { height: 1.2, diameter: 0.8 }, undefined);
        body.material = glassMat;
        body.parent = root;

        // Bottle Neck
        const neck = MeshBuilder.CreateCylinder("neck", { height: 0.6, diameterBottom: 0.8, diameterTop: 0.4 }, undefined);
        neck.position.y = 0.9;
        neck.material = glassMat;
        neck.parent = root;

        // Cork
        const corkMat = new StandardMaterial("corkMat");
        corkMat.diffuseColor = new Color3(0.55, 0.27, 0.07); // SaddleBrown

        const cork = MeshBuilder.CreateCylinder("cork", { height: 0.3, diameterBottom: 0.4, diameterTop: 0.48 }, undefined);
        cork.position.y = 1.35; // 0.9 + 0.3 + 0.15 for half height? 1.2/2 + 0.6/2?
        // Body y=0 (center). Height 1.2. Top is 0.6.
        // Neck y=0.9 via ThreeJS code.
        // Cork y=1.3 via ThreeJS code.
        cork.material = corkMat;
        cork.parent = root;

        // Paper Message
        const paperMat = new StandardMaterial("paperMat");
        paperMat.diffuseColor = new Color3(1, 1, 1);
        paperMat.backFaceCulling = false;

        const paper = MeshBuilder.CreatePlane("paper", { width: 0.3, height: 0.6 }, undefined);
        paper.rotation.y = Math.PI / 4;
        paper.rotation.z = Math.PI / 8;
        // Check local position
        paper.parent = root;
        paper.material = paperMat;

        return root;
    }

    private createFadeAnimation(target: TransformNode): AnimationGroup {
        const group = new AnimationGroup("fade");

        // Target all meshes under root
        const meshes = target.getChildMeshes();

        const fadeAnim = new Animation(
            "fadeAnim",
            "material.alpha",
            60,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keys = [
            { frame: 0, value: 0.6 },
            { frame: 60, value: 0 }
        ];
        fadeAnim.setKeys(keys);

        // Apply to everything for simplicity, though cork/paper might need different start values.
        // Original code: cork 1.0->0, glass 0.6->0.
        // Reuse same anim? No, different start values.

        for (const mesh of meshes) {
            const mat = mesh.material as StandardMaterial;
            if (mat) {
                const anim = fadeAnim.clone();
                const startAlpha = mat.name.includes("glass") ? 0.6 : 1.0;
                anim.setKeys([
                    { frame: 0, value: startAlpha },
                    { frame: 60, value: 0 }
                ]);
                group.addTargetedAnimation(anim, mat);
            }
        }

        return group;
    }

    private createDropAnimation(target: TransformNode): AnimationGroup {
        const group = new AnimationGroup("drop");

        const anim = new Animation(
            "dropAnim",
            "position.y",
            60,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // 0.25s duration -> 15 frames at 60fps
        const keys = [
            { frame: 0, value: 5.0 },
            { frame: 15, value: 0.0 }
        ];
        anim.setKeys(keys);

        group.addTargetedAnimation(anim, target);
        return group;
    }

    private createArcAnimation(target: TransformNode, direction: number): AnimationGroup {
        const group = new AnimationGroup(direction < 0 ? "arc-left" : "arc-right");

        const duration = 0.8; // 48 frames
        const frameCount = 48;

        const arcHeight = 8.0;
        const arcDistX = 4.0;

        const curve = Curve3.CreateQuadraticBezier(
            new Vector3(0, 0, 0),
            new Vector3(direction * arcDistX, arcHeight, 0),
            new Vector3(direction * arcDistX * 2.0, 0, 0),
            10 // steps
        );

        const points = curve.getPoints();
        const posKeys: any[] = [];
        const rotKeys: any[] = [];
        const upAxis = new Vector3(0, 1, 0);

        for (let i = 0; i < points.length; i++) {
            const t = i / (points.length - 1); // 0 to 1
            const frame = t * frameCount;

            // Position
            posKeys.push({ frame: frame, value: points[i] });

            // Rotation
            if (i < points.length - 1) {
                const tangent = points[i + 1].subtract(points[i]).normalize();
                const q = Quaternion.FromUnitVectorsToRef(upAxis, tangent, new Quaternion());
                rotKeys.push({ frame: frame, value: q });
            } else {
                // Last frame rotation same as previous?
                rotKeys.push({ frame: frame, value: rotKeys[rotKeys.length - 1].value });
            }
        }

        const posAnim = new Animation("posAnim", "position", 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys(posKeys);

        const rotAnim = new Animation("rotAnim", "rotationQuaternion", 60, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys(rotKeys);

        group.addTargetedAnimation(posAnim, target);
        // Ensure target has rotationQuaternion
        if (!target.rotationQuaternion) target.rotationQuaternion = Quaternion.Identity();
        group.addTargetedAnimation(rotAnim, target);

        return group;
    }
}
