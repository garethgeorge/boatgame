
import * as THREE from 'three';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Boat } from '../Boat';
import { Decorations } from '../../world/decorations/Decorations';
import { LSystemFlowerKind } from '../../world/factories/LSystemFlowerArchetypes';

export class LillyPadPatch extends Entity {
    private static cache: THREE.Group[] = [];
    private static preloaded = false;

    // Material for Lilly Pads
    private static padMaterial = new THREE.MeshToonMaterial({
        color: 0x228822, // Darker green than grass
        side: THREE.DoubleSide,
        name: 'LillyPad',
    });

    public static async preload() {
        if (this.preloaded) return;
        this.preloaded = true;
        GraphicsUtils.registerObject(this.padMaterial);
    }

    private width: number;

    constructor(x: number, y: number, width: number, length: number, rotation: number, physicsEngine: PhysicsEngine) {
        super();
        this.width = width;

        // Visuals
        const mesh = LillyPadPatch.getLillyPadMesh(width, length);
        this.meshes.push(mesh);

        // Physics Body (Sensor)
        const body = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            angle: rotation
        });

        // Approximate Ellipse
        const points: planck.Vec2[] = [];
        const segments = 12;
        for (let i = 0; i < segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const px = (width / 2) * Math.cos(theta);
            const py = (length / 2) * Math.sin(theta);
            points.push(planck.Vec2(px, py));
        }

        body.createFixture({
            shape: planck.Polygon(points),
            isSensor: true,
            userData: { type: 'lilly_pad_patch' }
        });

        body.setUserData({ type: 'lilly_pad_patch', entity: this });
        this.physicsBodies.push(body);

        this.sync();
    }

    update(dt: number): void {
        let contact = this.physicsBodies[0].getContactList();
        while (contact) {
            const otherBody = contact.other;
            const otherUserData = otherBody.getUserData() as any;

            if (contact.contact.isTouching() && otherUserData && (otherUserData.type === Entity.TYPE_PLAYER)) {
                const vel = otherBody.getLinearVelocity();
                const speed = vel.length();

                if (speed > 0.1) {
                    // Stronger drag to be noticeable
                    const dragFactor = 8.0;
                    const force = vel.clone().neg();
                    force.normalize();
                    // Quadratic drag
                    force.mul(dragFactor * speed * speed);
                    otherBody.applyForceToCenter(force, true);
                }
            }
            contact = contact.next;
        }
    }

    private static getLillyPadMesh(width: number, length: number): THREE.Group {
        if (!this.preloaded) {
            this.preload();
        }

        const group = new THREE.Group();

        // Configuration
        const area = Math.PI * (width / 2) * (length / 2);
        const count = Math.ceil(area * 0.4);

        // Pad Data
        interface PadData { x: number, z: number, radius: number }
        const pads: PadData[] = [];

        const padGeometries: THREE.BufferGeometry[] = [];

        // Flower parts
        const stalkGeometries: THREE.BufferGeometry[] = [];
        const petalGeometries: THREE.BufferGeometry[] = [];

        // Materials for flowers need to be captured from instances or assumed
        let stalkMaterial: THREE.Material | null = null;
        let petalMaterial: THREE.Material | null = null;

        // 1. Generate Pads
        for (let i = 0; i < count; i++) {
            // Random point in ellipse
            const r = Math.sqrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const lx = (width / 2) * r * Math.cos(theta);
            const lz = (length / 2) * r * Math.sin(theta);

            const scale = 0.5 + Math.random() * 0.5; // Random size

            // --- LILLY PAD ---
            const padRadius = 1.2 * scale;
            const thickness = 0.05 * scale; // Visual thickness
            const notchAngle = 0.5; // radians
            const totalAngle = Math.PI * 2 - notchAngle;

            pads.push({ x: lx, z: lz, radius: padRadius });

            // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
            const padGeo = new THREE.CylinderGeometry(padRadius, padRadius, thickness, 12, 1, false, notchAngle / 2, totalAngle);

            // Rotate randomly
            const rotation = Math.random() * Math.PI * 2;
            padGeo.rotateY(rotation);

            // Translate
            // We want it slightly above water (0.02)
            padGeo.translate(lx, 0.02 + thickness / 2, lz);

            padGeometries.push(padGeo);

            // --- LILY FLOWER (on top of pad) ---
            // 5% chance to have a flower on the pad (reduced from 20%)
            if (Math.random() < 0.05) {
                const flowerInstances = Decorations.getLSystemFlowerInstance({
                    kind: 'lily',
                    scale: scale * 0.5
                });

                for (const instance of flowerInstances) {
                    const geo = instance.geometry.clone();
                    if (!geo.attributes.position) { geo.dispose(); continue; }
                    geo.applyMatrix4(instance.matrix);
                    geo.translate(lx, 0.05, lz); // On top of pad

                    // Apply Color
                    const color = instance.color;
                    const count = geo.attributes.position.count;
                    const colors = new Float32Array(count * 3);
                    for (let k = 0; k < count; k++) {
                        colors[k * 3] = color.r;
                        colors[k * 3 + 1] = color.g;
                        colors[k * 3 + 2] = color.b;
                    }
                    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                    const matName = instance.material.name;
                    if (matName.includes('Stalk')) {
                        stalkGeometries.push(geo);
                        if (!stalkMaterial) stalkMaterial = instance.material;
                    } else {
                        petalGeometries.push(geo);
                        if (!petalMaterial) petalMaterial = instance.material;
                    }
                }
            }
        }

        // 2. Generate Water Lilies (in between pads)
        // Aim for roughly 1/8th as many water lilies as pads (reduced from 1/2)
        const waterLilyCount = Math.ceil(count * 0.125);
        let placed = 0;
        let attempts = 0;

        while (placed < waterLilyCount && attempts < waterLilyCount * 10) {
            attempts++;

            // Random point in ellipse
            const r = Math.sqrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const lx = (width / 2) * r * Math.cos(theta);
            const lz = (length / 2) * r * Math.sin(theta);

            const scale = 0.5 + Math.random() * 0.5;
            // Approximate radius of a water lily (3.0 length * 0.5 scale = 1.5 radius)
            // Use a bit conservative radius for collision check
            const flowerRadius = 1.0 * scale;

            // Check collision with pads
            let collision = false;
            for (const pad of pads) {
                const dx = lx - pad.x;
                const dz = lz - pad.z;
                const distSq = dx * dx + dz * dz;
                const minDist = pad.radius + flowerRadius;
                if (distSq < minDist * minDist) {
                    collision = true;
                    break;
                }
            }

            if (collision) continue;

            // Place Water Lily
            placed++;
            const flowerInstances = Decorations.getLSystemFlowerInstance({
                kind: 'waterlily',
                scale: scale * 0.5
            });

            for (const instance of flowerInstances) {
                const geo = instance.geometry.clone();
                if (!geo.attributes.position) { geo.dispose(); continue; }
                geo.applyMatrix4(instance.matrix);
                // Water lilies sit on water surface (y=0), maybe slightly up to avoid z-fight
                geo.translate(lx, 0.01, lz);

                // Apply Color
                const color = instance.color;
                const count = geo.attributes.position.count;
                const colors = new Float32Array(count * 3);
                for (let k = 0; k < count; k++) {
                    colors[k * 3] = color.r;
                    colors[k * 3 + 1] = color.g;
                    colors[k * 3 + 2] = color.b;
                }
                geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                const matName = instance.material.name;
                if (matName.includes('Stalk')) {
                    stalkGeometries.push(geo);
                    if (!stalkMaterial) stalkMaterial = instance.material;
                } else {
                    petalGeometries.push(geo);
                    if (!petalMaterial) petalMaterial = instance.material;
                }
            }
        }

        // --- MERGE & BUILD ---

        // 1. Pads
        if (padGeometries.length > 0) {
            const merged = BufferGeometryUtils.mergeGeometries(padGeometries);
            const mesh = GraphicsUtils.createMesh(merged, this.padMaterial, 'LillyPadPatch-Pads');
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            group.add(mesh);
            padGeometries.forEach(g => g.dispose());
        }

        // 2. Flowers
        if (stalkGeometries.length > 0 && stalkMaterial) {
            const merged = BufferGeometryUtils.mergeGeometries(stalkGeometries);
            // Ensure material supports vertex colors
            const mat = stalkMaterial.clone();
            mat.vertexColors = true;

            const mesh = GraphicsUtils.createMesh(merged, mat, 'LillyPadPatch-Stalks');
            group.add(mesh);
            stalkGeometries.forEach(g => g.dispose());
        }

        if (petalGeometries.length > 0 && petalMaterial) {
            const merged = BufferGeometryUtils.mergeGeometries(petalGeometries);
            // petalMaterial from factory already has vertexColors: true
            const mesh = GraphicsUtils.createMesh(merged, petalMaterial, 'LillyPadPatch-Petals');
            group.add(mesh);
            petalGeometries.forEach(g => g.dispose());
        }

        GraphicsUtils.markAsCache(group);
        return group;
    }
}
