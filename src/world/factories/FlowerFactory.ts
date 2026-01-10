import * as THREE from 'three';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class FlowerFactory implements DecorationFactory {
    private static readonly stalkMaterial = new THREE.MeshToonMaterial({ color: 0x44aa44, name: 'Flower - Stalk Material' });

    private headMaterials: THREE.MeshToonMaterial[] = [];
    private stalkGeometries: { geometry: THREE.BufferGeometry, height: number }[] = [];
    private headGeometries: THREE.BufferGeometry[] = [];

    async load(): Promise<void> {
        GraphicsUtils.registerObject(FlowerFactory.stalkMaterial);

        // Flower head colors
        const colors = [
            0xff5555, // Red
            0xffaa55, // Orange
            0xffff55, // Yellow
            0xff55ff, // Pink
            0xaa55ff, // Purple
            0x55ffff  // Cyan
        ];

        for (const color of colors) {
            const material = new THREE.MeshToonMaterial({ color, name: `Flower - Head Material ${color.toString(16)}` });
            GraphicsUtils.registerObject(material);
            this.headMaterials.push(material);
        }

        // Stalk Geometries (Short, Medium, Tall)
        const stalkHeights = [0.4, 0.7, 1.0];
        for (const height of stalkHeights) {
            const geo = new THREE.CylinderGeometry(0.02, 0.04, height, 5);
            geo.name = `Flower - Stalk Geometry ${height}`;
            // Shift geometry so base is at 0
            geo.translate(0, height / 2, 0);
            GraphicsUtils.registerObject(geo);
            this.stalkGeometries.push({ geometry: geo, height });
        }

        // Head Geometries
        const daisyGeo = new THREE.CylinderGeometry(0.3, 0.1, 0.08, 6);
        daisyGeo.name = 'Flower - Daisy Head Geometry';
        GraphicsUtils.registerObject(daisyGeo);
        this.headGeometries.push(daisyGeo);

        const bellGeo = new THREE.ConeGeometry(0.25, 0.45, 6);
        bellGeo.name = 'Flower - Bell Head Geometry';
        GraphicsUtils.registerObject(bellGeo);
        this.headGeometries.push(bellGeo);

        const berryGeo = new THREE.IcosahedronGeometry(0.2, 0);
        berryGeo.name = 'Flower - Berry Head Geometry';
        GraphicsUtils.registerObject(berryGeo);
        this.headGeometries.push(berryGeo);
    }

    public createInstance(): DecorationInstance[] {
        const stalkIdx = Math.floor(Math.random() * this.stalkGeometries.length);
        const headIdx = Math.floor(Math.random() * this.headGeometries.length);
        const colorIdx = Math.floor(Math.random() * this.headMaterials.length);

        const stalk = this.stalkGeometries[stalkIdx];
        const headGeom = this.headGeometries[headIdx];
        const headMat = this.headMaterials[colorIdx];

        const scale = 0.5 + Math.random() * 1.5;
        const rotationY = Math.random() * Math.PI * 2;

        const instances: DecorationInstance[] = [];

        // 1. Stalk Instance
        const stalkMatrix = new THREE.Matrix4();
        stalkMatrix.compose(
            new THREE.Vector3(0, 0, 0),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0)),
            new THREE.Vector3(scale, scale, scale)
        );
        instances.push({
            geometry: stalk.geometry,
            material: FlowerFactory.stalkMaterial,
            matrix: stalkMatrix
        });

        // 2. Head Instance
        const headMatrix = new THREE.Matrix4();
        const headPos = new THREE.Vector3(0, stalk.height * scale, 0);
        const headRot = new THREE.Euler(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.5
        );
        headMatrix.compose(
            headPos,
            new THREE.Quaternion().setFromEuler(headRot),
            new THREE.Vector3(scale, scale, scale)
        );
        instances.push({
            geometry: headGeom,
            material: headMat,
            matrix: headMatrix
        });

        return instances;
    }
}
