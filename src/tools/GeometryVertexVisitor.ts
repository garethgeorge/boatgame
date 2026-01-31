import * as THREE from 'three';

export type VertexVisitor = (vertex: THREE.Vector3) => void;

export class GeometryVertexVisitor {
    private static boneMatrix = new THREE.Matrix4();
    private static totalMatrix = new THREE.Matrix4();
    private static skinnedPos = new THREE.Vector3();
    private static pos = new THREE.Vector3();
    private static sw = new THREE.Vector4();
    private static si = new THREE.Vector4();

    /**
     * Traverses the object and visits all vertices in world space.
     * Handles CPU-side skinning for SkinnedMesh.
     */
    static visitVertices(object: THREE.Object3D, visitor: VertexVisitor) {
        object.traverse((child) => {
            if (child instanceof THREE.Mesh && child.visible) {
                const geometry = child.geometry;
                const positionAttr = geometry.getAttribute('position');
                const skinWeightAttr = geometry.getAttribute('skinWeight');
                const skinIndexAttr = geometry.getAttribute('skinIndex');

                const isSkinned = child instanceof THREE.SkinnedMesh &&
                    child.skeleton &&
                    skinWeightAttr &&
                    skinIndexAttr;

                if (positionAttr) {
                    for (let i = 0; i < positionAttr.count; i++) {
                        this.pos.fromBufferAttribute(positionAttr, i);

                        if (isSkinned) {
                            const skinnedMesh = child as THREE.SkinnedMesh;
                            const skeleton = skinnedMesh.skeleton;
                            const boneInverses = skeleton.boneInverses;
                            const bones = skeleton.bones;

                            this.totalMatrix.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

                            this.sw.fromBufferAttribute(skinWeightAttr, i);
                            this.si.fromBufferAttribute(skinIndexAttr, i);

                            for (let j = 0; j < 4; j++) {
                                const weight = this.sw.getComponent(j);
                                if (weight === 0) continue;

                                const boneIndex = this.si.getComponent(j);
                                const bone = bones[boneIndex];
                                const inverse = boneInverses[boneIndex];

                                this.boneMatrix.multiplyMatrices(bone.matrixWorld, inverse);

                                for (let k = 0; k < 16; k++) {
                                    this.totalMatrix.elements[k] += this.boneMatrix.elements[k] * weight;
                                }
                            }

                            this.skinnedPos.copy(this.pos).applyMatrix4(this.totalMatrix);
                            this.pos.copy(this.skinnedPos);

                        } else {
                            this.pos.applyMatrix4(child.matrixWorld);
                        }

                        visitor(this.pos);
                    }
                }
            }
        });
    }
}
