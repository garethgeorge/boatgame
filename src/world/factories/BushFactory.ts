import {
    TransformNode,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Mesh,
    Vector3,
    Quaternion,
    VertexData,
    Matrix
} from '@babylonjs/core';
import { DecorationFactory } from './DecorationFactory';

export class BushFactory implements DecorationFactory {
    private static dryBushMaterial: StandardMaterial;
    private static greenBushMaterial: StandardMaterial;

    private cache: { mesh: TransformNode, wetness: number }[] = [];

    async load(): Promise<void> {
        this.cache = [];
        import('@babylonjs/core').then(core => {
            if (!BushFactory.dryBushMaterial) {
                BushFactory.dryBushMaterial = new core.StandardMaterial("bushDry");
                BushFactory.dryBushMaterial.diffuseColor = core.Color3.FromHexString("#8B5A2B");
                BushFactory.dryBushMaterial.specularColor = core.Color3.Black();

                BushFactory.greenBushMaterial = new core.StandardMaterial("bushGreen");
                BushFactory.greenBushMaterial.diffuseColor = core.Color3.FromHexString("#32CD32");
                BushFactory.greenBushMaterial.specularColor = core.Color3.Black();
                BushFactory.greenBushMaterial.backFaceCulling = false; // DoubleSide
            }

            console.log("Generating Bush Cache...");
            for (let i = 0; i < 50; i++) {
                const wetness = Math.random();
                const mesh = this.createBush(wetness);
                mesh.setEnabled(false);
                this.cache.push({ mesh, wetness });
            }
        });
    }

    create(options?: { wetness?: number }): TransformNode {
        // Fallback
        if (!BushFactory.greenBushMaterial) return new TransformNode("bush_placeholder");

        const wetness = options?.wetness ?? 0.5; // Default if not provided
        // Note: original create(wetness) signature mismatch with interface requiring create(options?: any).
        // Assuming interface allows any.

        let mesh: TransformNode;
        if (this.cache.length === 0) {
            mesh = this.createBush(wetness);
        } else {
            const candidates = this.cache.filter(b => Math.abs(b.wetness - wetness) < 0.3);
            const source = candidates.length > 0
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : this.cache[Math.floor(Math.random() * this.cache.length)];

            if (source && source.mesh) {
                mesh = source.mesh.instantiateHierarchy() as TransformNode;
                mesh.setEnabled(true);
                // Babylon hierarchy instantiation shares materials implicitly
            } else {
                mesh = this.createBush(wetness);
            }
        }
        return mesh;
    }

    private createBush(wetness: number): TransformNode {
        const root = new TransformNode("bush_root");

        if (wetness > 0.5) {
            // FERN (Wet) - Larger
            const frondCount = 6 + Math.floor(Math.random() * 5);
            for (let i = 0; i < frondCount; i++) {
                const length = (1.5 + Math.random() * 1.5) * 3.0; // 3x larger
                const width = (0.5 + Math.random() * 0.3) * 3.0; // 3x larger

                const segments = 5;
                const segmentLen = length / segments;

                const curveGroup = new TransformNode("frond_curve");
                curveGroup.parent = root;

                const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.5);
                const angleX = Math.PI / 4 + Math.random() * 0.3;

                curveGroup.rotation.y = angleY;

                let currentPos = new Vector3(0, 0, 0);
                let currentAngle = angleX;

                for (let k = 0; k < segments; k++) {
                    const segWidth = width * (1 - k / segments);

                    // Plane Geometry
                    // Babylon CreatePlane defaults to XY plane centered at 0,0,0
                    // We need it to act like the segment.
                    // Translate up by segmentLen/2
                    const seg = MeshBuilder.CreatePlane("frond_seg", {
                        width: segWidth,
                        height: segmentLen,
                        sideOrientation: Mesh.DOUBLESIDE
                    });

                    // Translate geometry equivalent in Babylon?
                    // We can bake transform or just offset child.
                    // Bake transform:
                    // seg.bakeTransformIntoVertices(Matrix.Translation(0, segmentLen/2, 0));
                    // Or simply position it relative to a pivot.
                    // Let's just set position.

                    // But we need to rotate it X by currentAngle.
                    // And position it at currentPos.

                    // However, we need the "segment" to start at currentPos and go UP-rotated.
                    // If we position center at currentPos, it's wrong.
                    // We need base at currentPos.

                    // Create pivot wrapper? Or use locallyTranslate.
                    // Let's use pivot wrapper.
                    const segPivot = new TransformNode("seg_pivot");
                    segPivot.position = currentPos.clone();
                    segPivot.rotation.x = currentAngle;
                    segPivot.parent = curveGroup;

                    seg.parent = segPivot;
                    seg.position.y = segmentLen / 2;
                    seg.material = BushFactory.greenBushMaterial;

                    // Calculate next pos
                    // Vector (0, segmentLen, 0) rotated by currentAngle around X
                    // Applying rotation to vector:
                    const vec = new Vector3(0, segmentLen, 0);
                    // Rotate vec by X axis
                    const matrix = Matrix.RotationX(currentAngle);
                    const offset = Vector3.TransformCoordinates(vec, matrix);

                    currentPos.addInPlace(offset);
                    currentAngle += 0.25; // Less curve for longer fronds
                }
            }

        } else {
            // DEAD BUSH (Dry)
            const material = BushFactory.dryBushMaterial;

            const generateJaggedBranch = (start: Vector3, len: number, thick: number, depth: number, ang: Vector3, parent: TransformNode) => {
                if (depth === 0) return;

                // End position relative to start
                // Euler to Matrix/Quaternion
                const rotQuat = Quaternion.FromEulerVector(ang);
                const forward = new Vector3(0, len, 0);
                const endOffset = forward.applyRotationQuaternion(rotQuat);

                // Midpoint for cylinder center
                const midOffset = endOffset.scale(0.5);
                const midPos = start.add(midOffset);

                const mesh = MeshBuilder.CreateCylinder("dead_branch", {
                    height: len,
                    diameterTop: thick * 0.7,
                    diameterBottom: thick,
                    tessellation: 4
                });
                mesh.material = material;
                mesh.rotationQuaternion = rotQuat;
                mesh.position = midPos;
                mesh.parent = parent;

                // End point in world (or parent local) space
                const endPos = start.add(endOffset);

                // 1 or 2 sub-branches, jagged angles
                const count = 1 + Math.floor(Math.random() * 2);
                for (let i = 0; i < count; i++) {
                    const newLen = len * 0.6;
                    const newThick = thick * 0.7;

                    // Jagged angle: abrupt change
                    const newAng = new Vector3(
                        ang.x + (Math.random() - 0.5) * 2.0,
                        ang.y + (Math.random() - 0.5) * 2.0,
                        ang.z + (Math.random() - 0.5) * 2.0
                    );
                    generateJaggedBranch(endPos, newLen, newThick, depth - 1, newAng, parent);
                }
            };

            // 2-3 Stems from ground
            const stemCount = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < stemCount; i++) {
                // Random angle out from center
                const angleY = Math.random() * Math.PI * 2;
                const angleX = 0.3 + Math.random() * 0.5; // Angle up from ground

                const startAngle = new Vector3(
                    (Math.random() - 0.5) * 1.5 + angleX,
                    angleY,
                    (Math.random() - 0.5) * 1.5
                );

                // Increase base size by 3x
                generateJaggedBranch(new Vector3(0, 0, 0), 0.5 * 3.0, 0.1 * 3.0, 3, startAngle, root);
            }
        }

        // Optimization: Merge meshes
        const meshes = root.getChildMeshes();
        const merged = Mesh.MergeMeshes(meshes as Mesh[], true, true, undefined, false, true);

        if (merged) {
            merged.name = "bush_merged";
            merged.metadata = { mergeable: true };
            root.dispose();
            return merged;
        }

        return root;
    }
}
