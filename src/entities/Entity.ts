import * as planck from 'planck';
import * as THREE from 'three';
import { GraphicsUtils } from '../core/GraphicsUtils';
import { Boat } from '../entities/Boat';
import { PhysicsUtils } from '../core/PhysicsUtils';

export abstract class Entity {

    // Physics body type names
    public static readonly TYPE_PLAYER = 'player';
    public static readonly TYPE_OBSTACLE = 'obstacle';
    public static readonly TYPE_COLLECTABLE = 'collectable';

    // Physics fixture type names
    public static readonly TYPE_SENSOR = 'sensor';

    private _parent: Entity | null = null;
    private _children: Entity[] = [];

    public physicsBodies: planck.Body[] = [];
    public meshes: THREE.Object3D[] = [];
    public debugMeshes: THREE.Object3D[] = [];

    // Set to true to have the entity deleted
    public shouldRemove: boolean = false;

    // True for entities that can cause penalties
    public canCausePenalty: boolean = false;

    // Set to true when this entity has caused a penalty to avoid repetition
    public hasCausedPenalty: boolean = false;

    // Optional normal vector for terrain alignment
    // If set, mesh will be tilted so its Y-axis aligns with this normal
    // while still following physics rotation around Y
    protected normalVector: THREE.Vector3 | null = null;

    public isVisible: boolean = true;

    constructor() { }

    public parent(): Entity | null {
        return this._parent;
    }

    public setParent(parent: Entity | null) {
        this._parent = parent;
        if (parent) {
            for (const body of this.physicsBodies) {
                body.setType(planck.Body.KINEMATIC);
                PhysicsUtils.setCollisionMask(body, 0);
            }
        } else {
            for (const body of this.physicsBodies) {
                //body.setType(planck.Body.KINEMATIC);
                PhysicsUtils.setCollisionMask(body, 0xFFFF);
            }
        }
    }

    public children(): Entity[] {
        return this._children;
    }

    public addChild(child: Entity) {
        if (this.meshes.length > 0 && child.meshes.length > 0) {
            const parentMesh = this.meshes[0];
            const childMesh = child.meshes[0];

            parentMesh.attach(childMesh);
            child.setParent(this);

            if (!this._children.includes(child)) {
                this._children.push(child);
            }
        }
    }

    public removeChild(child: Entity) {
        const index = this._children.indexOf(child);
        if (index === -1) return;

        this._children.splice(index, 1);

        if (child.meshes.length > 0) {
            const childMesh = child.meshes[0];

            // Find the root scene
            let scene: THREE.Object3D = childMesh;
            while (scene.parent) {
                scene = scene.parent;
            }

            scene.attach(childMesh);
            child.setParent(null);
        }
    }

    public setAnimationThrottle(throttle: number) {
        // No-op by default
    }

    /**
     * 1. Called each frame to compute the entity state for the next frame.
     * Use this phase for read-only calculations and goal setting.
     */
    abstract updateLogic(dt: number): void;

    /**
     * 2. Called each frame to apply the next entity state for the next frame.
     * Use this phase to modify physics state for dynamic entities and the
     * visuals for kinematic entities. This function is called recursively.
     */
    public applyUpdate(dt: number) {
        // By default, if we are kinematic, we sync the physics body to the mesh
        // which might have been moved by some logic/parenting.
        if (this.physicsBodies.length > 0 && this.meshes.length > 0) {
            const body = this.physicsBodies[0];
            const mesh = this.meshes[0];
            if (body.getType() === 'kinematic') {
                this.syncMeshToBody(mesh, body);
            }
        }
    }

    /**
     * 3. Called after applyUpdate and before removals. 
     * Use this phase for scene graph modifications (like unparenting) 
     * that are unsafe during the hierarchical applyUpdate pass.
     */
    public updateSceneGraph() {
    }

    /**
     * 4. Called each frame to update visuals based on physics and delta time.
     * Use this phase for interpolation, animations, and non-physics FX.
     */
    public updateVisuals(dt: number, alpha: number = 1.0) {
        let yPos = 0;
        if (this.physicsBodies.length > 0 && this.meshes.length > 0) {
            const body = this.physicsBodies[0];
            const mesh = this.meshes[0];
            this.updateBodyMeshVisuals(body, mesh, alpha);
            yPos = mesh.position.y;
        }

        for (let i = 0; i < Math.min(this.physicsBodies.length, this.debugMeshes.length); i++) {
            const debugMesh = this.debugMeshes[i];
            this.updateBodyMeshVisuals(this.physicsBodies[i], debugMesh, alpha);
            debugMesh.position.y = yPos + 1.0;
        }
    }

    // Do stuff when hit by the player
    wasHitByPlayer(boat: Boat): void {
    }

    // Helper function to destroy all physics bodies for the entity
    destroyPhysicsBodies() {
        for (const body of this.physicsBodies) {
            const world = body.getWorld();
            world.destroyBody(body);
        }
        this.physicsBodies = [];
    }

    destroyDebugMeshes() {
        for (const debugMesh of this.debugMeshes) {
            GraphicsUtils.disposeObject(debugMesh);
        }
        this.debugMeshes = [];
    }

    dispose() {
        for (const mesh of this.meshes) {
            GraphicsUtils.disposeObject(mesh);
        }
        this.destroyDebugMeshes();
        this.meshes = [];
        this.physicsBodies = [];
    }

    setVisible(visible: boolean) {
        this.isVisible = visible;
        for (const mesh of this.meshes) {
            mesh.visible = visible;
        }
        for (const debugMesh of this.debugMeshes) {
            debugMesh.visible = visible;
        }
    }

    // Interpolation state
    private prevPos: Map<planck.Body, planck.Vec2> = new Map();
    private prevAngle: Map<planck.Body, number> = new Map();

    savePreviousState() {
        for (const body of this.physicsBodies) {
            this.prevPos.set(body, body.getPosition().clone());
            this.prevAngle.set(body, body.getAngle());
        }
    }

    protected updateBodyMeshVisuals(body: planck.Body, mesh: THREE.Object3D, alpha: number) {
        if (this.parent() && body.getType() !== 'kinematic') {
            // If we have a parent, we only sync if we are in kinematic mode. 
            // Otherwise, the physics body and mesh position will diverge in world space.
            return;
        }

        if (body.getType() === 'kinematic') {
            // Kinematic visual sync is handled by parenting or applyUpdate's Mesh->Body sync
            // We only need to ensure the mesh transform is up to date if not already handled
        } else {
            // Dynamic motion: Interpolate physics body to mesh visuals
            const currPos = body.getPosition();
            const currAngle = body.getAngle();

            let pos = currPos;
            let angle = currAngle;

            // Interpolate if we have previous state 
            if (this.prevPos.has(body) && this.prevAngle.has(body)) {
                const prevPos = this.prevPos.get(body)!;
                const prevAngle = this.prevAngle.get(body)!;

                const x = prevPos.x * (1 - alpha) + currPos.x * alpha;
                const y = prevPos.y * (1 - alpha) + currPos.y * alpha;
                pos = planck.Vec2(x, y);

                // Interpolate angle (handle wrap-around if necessary, but Planck angles are continuous)
                angle = prevAngle * (1 - alpha) + currAngle * alpha;
            }

            mesh.position.x = pos.x;
            mesh.position.z = pos.y; // Map 2D Physics Y to 3D Graphics Z

            // Apply rotation with optional normal alignment
            if (this.normalVector) {
                //mesh.setRotationFromAxisAngle(this.normalVector.clone(), -angle);
                const up = new THREE.Vector3(0, 1, 0); // Default Y-axis
                const normalQuaternion = new THREE.Quaternion().setFromUnitVectors(up, this.normalVector);

                // The axis for this rotation is the targetNormal itself
                const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(this.normalVector, -angle);

                // Multiply the orientation by the rotation to get the final transformation
                // Order matters: first align, then rotate around the aligned axis.
                mesh.quaternion.multiplyQuaternions(rotationQuaternion, normalQuaternion);
            } else {
                // Standard rotation around Y. Intentionally preserves any other rotations.
                mesh.rotation.y = -angle;
            }
        }
    }

    protected syncMeshToBody(mesh: THREE.Object3D, body: planck.Body) {
        // Extract world transform to sync kinematic body
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();

        mesh.getWorldPosition(worldPos);
        mesh.getWorldQuaternion(worldQuat);

        const worldEuler = new THREE.Euler().setFromQuaternion(worldQuat, 'YXZ');
        const planckAngle = -worldEuler.y;

        body.setPosition(planck.Vec2(worldPos.x, worldPos.z));
        body.setAngle(planckAngle);
    }

    ensureDebugMeshes(): THREE.Object3D[] {
        if (this.debugMeshes.length > 0) return this.debugMeshes;
        if (this.physicsBodies.length === 0) return [];

        for (const body of this.physicsBodies) {
            const group = new THREE.Group();

            for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
                const shape = fixture.getShape();
                const type = shape.getType();

                let mesh: THREE.Mesh | null = null;
                let line: THREE.Line | null = null;

                if (type === 'circle') {
                    const circle = shape as planck.Circle;
                    const radius = circle.getRadius();
                    const center = circle.getCenter();

                    const geometry = new THREE.CylinderGeometry(radius, radius, 1, 16);
                    geometry.name = `Debug - Physics Circle`;
                    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                    material.name = `Debug - Physics Material`;

                    mesh = GraphicsUtils.createMesh(geometry, material, 'EntityDebugCylinder');
                    mesh.position.set(center.x, 0, center.y);
                } else if (type === 'polygon') {
                    const poly = shape as planck.Polygon;
                    const vertices = (poly as any).m_vertices;

                    const points: THREE.Vector3[] = [];
                    for (const v of vertices) {
                        points.push(new THREE.Vector3(v.x, 0, v.y));
                    }
                    if (points.length > 0) {
                        points.push(points[0].clone());
                    }

                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    geometry.name = `Debug - Physics Polygon`;
                    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
                    lineMaterial.name = `Debug - Physics Line Material`;

                    line = GraphicsUtils.createLine(geometry, lineMaterial, 'EntityDebugPolygon');
                }

                if (mesh) group.add(mesh);
                if (line) group.add(line);
            }

            // Initial visuals sync
            this.updateBodyMeshVisuals(body, group, 1.0);
            if (this.meshes.length > 0) {
                group.position.y = this.meshes[0].position.y + 1.0;
            } else {
                group.position.y = 1.0;
            }
            this.debugMeshes.push(group);
        }

        return this.debugMeshes;
    }
}
