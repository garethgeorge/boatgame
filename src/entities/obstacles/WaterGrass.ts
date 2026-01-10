import * as THREE from 'three';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class WaterGrass extends Entity {
    private static cache: THREE.Group[] = [];
    private static readonly CACHE_SIZE = 20;

    // Material
    private static material = new THREE.MeshToonMaterial({
        color: 0x44aa44,
        side: THREE.DoubleSide, 
        name: 'WaterGrassLeaf',
        transparent: true,
        opacity: 0.8
    });

    public static async preload() {
        GraphicsUtils.registerObject(this.material);
    }

    private width: number;
    private density: number;

    constructor(x: number, y: number, width: number, length: number, rotation: number, physicsEngine: PhysicsEngine) {
        super();
        this.width = width;
        // Density of wisps per unit area
        this.density = 2.0;

        // Visuals
        const mesh = WaterGrass.getWaterGrassMesh(width, length);
        this.meshes.push(mesh);

        // Physics Body (Sensor)
        const body = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            angle: rotation // Apply rotation
        });

        // Approximate Oval with a Polygon (Hexagon or Octagon)
        // Or just a Box if simple. Oval is requested.
        // Let's create an 8-sided polygon to approximate the ellipse
        const points: planck.Vec2[] = [];
        const segments = 16;
        for (let i = 0; i < segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            // Ellipse equation: x = a cos t, y = b sin t
            // width is x-axis (lateral), length is y-axis (longitudinal) in Physics
            // Wait, Physics Y is Longitudinal (World Z)
            // Physics X is Lateral (World X)
            // So width maps to Physics X, length maps to Physics Y
            const px = (width / 2) * Math.cos(theta);
            const py = (length / 2) * Math.sin(theta);
            points.push(planck.Vec2(px, py));
        }

        body.createFixture({
            shape: planck.Polygon(points),
            isSensor: true, // It's a trap, not a wall
            userData: { type: 'water_grass' } 
        });
        
        body.setUserData({ type: 'water_grass', entity: this });
        this.physicsBodies.push(body);

        this.sync();
    }

    update(dt: number): void {
        // Drag Logic
        // Iterate all contacts
        let contact = this.physicsBodies[0].getContactList();
        while (contact) {
            const otherBody = contact.other;
            const otherUserData = otherBody.getUserData() as any;

            if (contact.contact.isTouching() && otherUserData && (otherUserData.type === Entity.TYPE_PLAYER)) {
                // Apply drag force
                // Drag Force Fd = -0.5 * rho * v^2 * Cd * A
                // Simplified: F = -k * v * |v|  or  F = -k * v
                
                // Get velocity of the boat
                const vel = otherBody.getLinearVelocity();
                const speed = vel.length();

                if (speed > 0.1) {
                    const dragFactor = 20.0; // Increased from 5.0 for stronger effect
                    // Force opposes velocity
                    const force = vel.clone().neg();
                    force.normalize();
                    // Quadratic drag feels more natural for water
                    force.mul(dragFactor * speed * speed);
                    // Or maybe just linear for "thick grass"? 
                    // Let's try quadratic first.
                    
                    // Apply force to the boat center
                    otherBody.applyForceToCenter(force, true);
                }
            }
            contact = contact.next;
        }
    }

    private static getWaterGrassMesh(width: number, length: number): THREE.Group {
        // We can't easily cache purely based on random size.
        // But if width/length are standardized, we could.
        // For now, let's just generate it. It's just a bunch of planes.

        const group = new THREE.Group();
        const geometries: THREE.BufferGeometry[] = [];

        // Determine number of wisps
        // Area of ellipse = pi * a * b
        const area = Math.PI * (width / 2) * (length / 2);
        const count = Math.ceil(area * 3.0); // 3 wisps per unit area approx

        const baseColor = new THREE.Color(0x44aa44);

        for (let i = 0; i < count; i++) {
            // Random point in ellipse
            // r = sqrt(random), theta = random * 2pi
            const r = Math.sqrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            
            const x = (width / 2) * r * Math.cos(theta); // World X
            const z = (length / 2) * r * Math.sin(theta); // World Z (Physics Y)

            // Wisp geometry
            // Simple plane or crossed planes
            // Let's do a simple quad standing up
            const wispH = 0.5 + Math.random() * 0.5;
            const wispW = 0.5 + Math.random() * 0.3;

            const geometry = new THREE.PlaneGeometry(wispW, wispH);
            geometry.translate(0, wispH / 2 - 0.2, 0); // Pivot at bottom, sink slightly

            // Rotate randomly
            geometry.rotateY(Math.random() * Math.PI * 2);

            // Position
            geometry.translate(x, 0, z);

            geometries.push(geometry);
        }

        if (geometries.length > 0) {
            const merged = BufferGeometryUtils.mergeGeometries(geometries);
            const mesh = GraphicsUtils.createMesh(merged, this.material, 'WaterGrassPatch');
            mesh.receiveShadow = false;
            
            // To be "under water surface", y should be slightly negative?
            // Water usually is at y=0 or y=-0.5?
            // "visible under the water surface"
            // Let's push them down a bit.
            mesh.position.y = -0.2; 

            group.add(mesh);
            
            // Cleanup individual geometries
            geometries.forEach(g => g.dispose());
        }

        return group;
    }
}
