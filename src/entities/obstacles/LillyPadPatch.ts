
import * as THREE from 'three';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Boat } from '../Boat';
import { Decorations } from '../../world/Decorations';
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

        const padGeometries: THREE.BufferGeometry[] = [];
        
        // Flower parts
        const stalkGeometries: THREE.BufferGeometry[] = [];
        const petalGeometries: THREE.BufferGeometry[] = [];
        const centerGeometries: THREE.BufferGeometry[] = [];

        // Materials for flowers need to be captured from instances or assumed
        let stalkMaterial: THREE.Material | null = null;
        let petalMaterial: THREE.Material | null = null;

        for (let i = 0; i < count; i++) {
            // Random point in ellipse
            const r = Math.sqrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const lx = (width / 2) * r * Math.cos(theta);
            const lz = (length / 2) * r * Math.sin(theta);

            const scale = 0.5 + Math.random() * 0.5; // Random size

            // --- 1. LILLY PAD ---
            // Increased radius relative to flower (was 0.8 * scale, now 1.2 * scale for 1.5x bigger)
            const padRadius = 1.2 * scale; 
            const thickness = 0.05 * scale; // Visual thickness
            const notchAngle = 0.5; // radians
            const totalAngle = Math.PI * 2 - notchAngle;
            
            // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
            // Default Cylinder is vertical (Y-axis), which is what we want for "flat on water" if we consider thickness is Y.
            const padGeo = new THREE.CylinderGeometry(padRadius, padRadius, thickness, 12, 1, false, notchAngle / 2, totalAngle);
            
            // Rotate randomly
            const rotation = Math.random() * Math.PI * 2;
            padGeo.rotateY(rotation);

            // Translate
            // Center is at 0,0,0 local (so it dips below 0 by thickness/2)
            // We want it slightly above water (0.02)
            padGeo.translate(lx, 0.02 + thickness / 2, lz);

            padGeometries.push(padGeo);

            // --- 2. FLOWER (1 in 9 chance) ---
            if (Math.random() < 0.11) {
                 const flowerInstances = Decorations.getLSystemFlowerInstance({
                     kind: 'waterlily',
                     scale: scale * 0.5 // Slightly smaller relative to the new giant pad
                 });

                 for (const instance of flowerInstances) {
                     const geo = instance.geometry.clone();
                     
                     // Skip empty geometries (e.g. waterlilies have no stalks)
                     if (!geo.attributes.position) {
                         geo.dispose();
                         continue;
                     }

                     // Apply instance matrix (which includes scale)
                     geo.applyMatrix4(instance.matrix);

                     // Position on the pad (at lx, lz)
                     // Flowers usually sit on top.
                     geo.translate(lx, 0.05, lz); // Slightly above pad

                     // Apply Color to Vertices
                     const color = instance.color;
                     const rgb = [color.r, color.g, color.b];
                     const count = geo.attributes.position.count;
                     const colors = new Float32Array(count * 3);
                     for(let k=0; k<count; k++) {
                         colors[k*3] = rgb[0];
                         colors[k*3+1] = rgb[1];
                         colors[k*3+2] = rgb[2];
                     }
                     geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                     // Sort into buckets
                     // We identify based on material name or type
                     // LSystemFlowerFactory uses 'LSystemFlower - Stalk' and 'LSystemFlower - Petal'
                     const matName = instance.material.name;
                     if (matName.includes('Stalk')) {
                         stalkGeometries.push(geo);
                         if (!stalkMaterial) stalkMaterial = instance.material;
                     } else if (matName.includes('Petal')) {
                         // Centers also use Petal material in the factory
                         // But we can check if it's a center by geometry type if needed?
                         // Actually merging them all into Petal is fine as long as they use the same shader.
                         // But Center might be 'center' part.
                         // The factory groups center and petal separately in createInstance but uses same material.
                         petalGeometries.push(geo);
                         if (!petalMaterial) petalMaterial = instance.material;
                     } else {
                         // Fallback
                         petalGeometries.push(geo);
                     }
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
            // We need to register this new material variant? 
            // Or just modify the instance material? 
            // Ideally we shouldn't modify the static material from the factory.
            // But we don't want to create 1000 materials.
            // Let's create a shared one for patches if possible.
            // For now, new material is safer.
            
            const mesh = GraphicsUtils.createMesh(merged, mat, 'LillyPadPatch-Stalks');
            group.add(mesh);
            stalkGeometries.forEach(g => g.dispose());
        }

        if (petalGeometries.length > 0 && petalMaterial) {
            const merged = BufferGeometryUtils.mergeGeometries(petalGeometries);
            // petalMaterial from factory already has vertexColors: true (it's LeafShader-based)
            const mesh = GraphicsUtils.createMesh(merged, petalMaterial, 'LillyPadPatch-Petals');
            group.add(mesh);
            petalGeometries.forEach(g => g.dispose());
        }

        GraphicsUtils.markAsCache(group);
        return group;
    }
}
