import * as planck from 'planck';
import * as THREE from 'three';
import { GraphicsUtils } from '../core/GraphicsUtils';
import { Boat } from '../entities/Boat';
import { PhysicsUtils } from '../core/PhysicsUtils';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';

export abstract class Entity {

    // Physics body type names
    public static readonly TYPE_PLAYER = 'player';
    public static readonly TYPE_OBSTACLE = 'obstacle';
    public static readonly TYPE_COLLECTABLE = 'collectable';

    // Physics fixture type names
    public static readonly TYPE_SENSOR = 'sensor';

    private static _nextCollisionGroupId: number = 1;
    private _collisionGroupId: number = 0;

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


    public isVisible: boolean = true;

    constructor() {
    }

    public parent(): Entity | null {
        return this._parent;
    }

    private setParent(parent: Entity | null) {
        this._parent = parent;
    }

    private updateCollisionGroupId(id: number) {
        if (id === this._collisionGroupId) return;
        this._collisionGroupId = id;

        for (const body of this.physicsBodies) {
            if (id !== 0 && this._parent) {
                body.setType(planck.Body.KINEMATIC);
            }
            PhysicsUtils.setCollisionGroup(body, id);
        }

        for (const child of this._children) {
            child.updateCollisionGroupId(id);
        }
    }

    public children(): Entity[] {
        return this._children;
    }

    public addChild(child: Entity) {
        if (this._children.includes(child)) return;
        this._children.push(child);

        if (this.meshes.length > 0 && child.meshes.length > 0) {
            const parentMesh = this.meshes[0];
            const childMesh = child.meshes[0];

            parentMesh.attach(childMesh);
            child.setParent(this);
        }

        // If first child added to parent get a group id and set
        // on parent and children. Otherwise set group id on child
        if (this._collisionGroupId === 0) {
            const id = Entity._nextCollisionGroupId++;
            this.updateCollisionGroupId(-id);
        } else {
            child.updateCollisionGroupId(this._collisionGroupId);
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

        // If child has no children clear its group id otherwise assign
        // a new one to the detached tree
        if (child._children.length === 0) {
            child.updateCollisionGroupId(0);
        } else {
            const id = Entity._nextCollisionGroupId++;
            child.updateCollisionGroupId(-id);
        }
        // If parent has no children clear group id otherwise keep it
        if (this._children.length === 0) {
            this.updateCollisionGroupId(0);
        }
    }

    public setAnimationThrottle(throttle: number) {
        // No-op by default
    }

    /**
     * 1. Called each frame to compute the entity state for the next frame.
     * Use this phase for read-only calculations and goal setting.
     */
    public updateLogic(dt: number): void {
    }

    /**
     * 2. Called each frame to apply the next entity state for the next frame.
     * Use this phase to modify physics state for dynamic entities.
     */
    public updatePhysics(dt: number): void {
    }

    /**
     * 3. Called each frame to apply updates to the scene graph either from
     * updateLogic() or updatePhysics(). Called recursively so that parent
     * is updated before children. Call super.updateVisuals() to ensure
     * physics and mesh are synchronized.
     * 
     * Kinematic objects use this to update the mesh visuals then call
     * super to update physics from mesh. Dynamic objects generally call
     * super to update mesh from physics then apply any other changes.
     */
    public updateVisuals(dt: number, alpha: number = 1.0): void {
        let yPos = 0;
        if (this.physicsBodies.length > 0 && this.meshes.length > 0) {
            const body = this.physicsBodies[0];
            const mesh = this.meshes[0];

            // For kinematic the mesh is directly controlled and the physics follows
            // along. For dynamic physics controls the mesh.
            if (body.getType() === 'kinematic') {
                this.syncMeshToBody(mesh, body);
            } else if (this.parent()) {
                // when parented should be kinematic but may not switch immediately
            } else {
                this.syncBodyToMesh(body, mesh, alpha);
            }

            yPos = mesh.position.y;
        }

        for (let i = 0; i < Math.min(this.physicsBodies.length, this.debugMeshes.length); i++) {
            const debugMesh = this.debugMeshes[i];
            this.syncBodyToMesh(this.physicsBodies[i], debugMesh, alpha);
            debugMesh.position.y = yPos + 1.0;
        }
    }

    /**
     * Called during visual sync to get the vertical position and orientation
     * of the entity. Returning null results in standard Y-rotation.
     */
    protected getDynamicPose(pos: planck.Vec2, angle: number): { height: number, quaternion: THREE.Quaternion } | null {
        return null;
    }

    /**
     * 4. Called after updateVisuals and before removals. 
     * Use this phase for scene graph modifications (like unparenting) 
     * that are unsafe during the hierarchical applyUpdate pass.
     */
    public updateSceneGraph(): void {
    }

    /**
     * Called at the end of life for the entity.
     */
    public terminate() {
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

    private syncBodyToMesh(body: planck.Body, mesh: THREE.Object3D, alpha: number) {
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

        // Apply rotation with optional dynamic pose
        const pose = this.getDynamicPose(pos, angle);
        if (pose) {
            mesh.position.y = pose.height;
            mesh.quaternion.copy(pose.quaternion);
        } else {
            // Standard rotation around Y
            mesh.rotation.y = -angle;
        }
    }

    private syncMeshToBody(mesh: THREE.Object3D, body: planck.Body) {
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

    ensureDebugMeshes(): void {
        if (this.debugMeshes.length > 0) return;
        if (this.physicsBodies.length === 0) return;

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
            this.syncBodyToMesh(body, group, 1.0);
            if (this.meshes.length > 0) {
                group.position.y = this.meshes[0].position.y + 1.0;
            } else {
                group.position.y = 1.0;
            }
            this.debugMeshes.push(group);
        }
    }
}
