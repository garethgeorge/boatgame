import { MeshBuilder, StandardMaterial, Color3, TransformNode, Vector3, Mesh, Curve3, Engine, Scene } from '@babylonjs/core';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Mangrove extends Entity {
  private static trunkMaterial: StandardMaterial | null = null;
  private static leafMaterial: StandardMaterial | null = null;

  constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
    super();

    const scene = Engine.LastCreatedScene;
    if (!scene) return;

    const radius = 4.5; // Collision radius

    // Physics Body
    const body = physicsEngine.world.createBody({
      type: 'static',
      position: planck.Vec2(x, y)
    });

    body.createFixture({
      shape: planck.Circle(radius),
      density: 1.0,
      friction: 0.5,
      restitution: 0.1
    });

    body.setUserData({ type: 'obstacle', entity: this });
    this.physicsBodies.push(body);

    // Procedural Generation
    const root = new TransformNode("mangrove_root", scene);
    this.meshes.push(root);

    const woodMeshes: Mesh[] = [];
    const leafMeshes: Mesh[] = [];

    const height = 15 + Math.random() * 10;
    const trunkHeight = height * 0.6;
    const rootHeight = height * 0.25;

    // 1. Roots
    const rootCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < rootCount; i++) {
      const angle = (i / rootCount) * Math.PI * 2 + Math.random() * 0.5;
      const startH = rootHeight * (0.6 + Math.random() * 0.4);
      const endR = 4.0 + Math.random() * 3.0;

      const points = [
        new Vector3(0, startH, 0),
        new Vector3(Math.cos(angle) * endR * 0.5, startH * 0.4, Math.sin(angle) * endR * 0.5),
        new Vector3(Math.cos(angle) * endR, 0, Math.sin(angle) * endR)
      ];
      const spline = Curve3.CreateCatmullRomSpline(points, 4).getPoints();
      const rootMesh = MeshBuilder.CreateTube("root", { path: points, radius: 0.5, tessellation: 6 }, scene);
      woodMeshes.push(rootMesh);
    }

    // 2. Trunk
    const trunkSegments = 5;
    const trunkPoints: Vector3[] = [];
    for (let i = 0; i <= trunkSegments; i++) {
      const t = i / trunkSegments;
      const yPos = rootHeight + t * trunkHeight;
      const jitter = (t > 0 && t < 1) ? 0.6 : 0.0;
      trunkPoints.push(new Vector3((Math.random() - 0.5) * jitter, yPos, (Math.random() - 0.5) * jitter));
    }
    const trunkMesh = MeshBuilder.CreateTube("trunk", { path: trunkPoints, radius: 1.2, tessellation: 7 }, scene);
    woodMeshes.push(trunkMesh);

    // 3. Canopy
    const branchCount = 6 + Math.floor(Math.random() * 4);
    const branchStartY = rootHeight + trunkHeight * 0.5;

    for (let i = 0; i < branchCount; i++) {
      const angle = (i / branchCount) * Math.PI * 2 + Math.random();
      const len = (3.0 + Math.random() * 2.5) * 4.0;
      const bY = branchStartY + (Math.random() * trunkHeight * 0.4);

      const branchMesh = MeshBuilder.CreateCylinder("branch", { height: len, diameterTop: 0.3, diameterBottom: 0.6, tessellation: 5 }, scene);
      branchMesh.position.set(0, bY, 0);

      // Manual rotation logic to match Three.js behavior
      const zRot = Math.PI / 2 - 0.2 - Math.random() * 0.4;
      branchMesh.rotation.y = angle;
      branchMesh.rotation.z = zRot;

      // Move visual so pivot is at start
      // Cylinder's center is at 0. Shift it.
      branchMesh.locallyTranslate(new Vector3(0, len / 2, 0));
      woodMeshes.push(branchMesh);

      // Leaf Disks along branch
      const diskCount = 4 + Math.floor(Math.random() * 3);
      const dir = new Vector3(0, 1, 0);
      // Calculate world dir for disks
      const rotMat = branchMesh.getWorldMatrix();
      const worldDir = Vector3.TransformNormal(dir, rotMat).normalize();
      const startPos = new Vector3(0, bY, 0);

      for (let j = 0; j < diskCount; j++) {
        const t = 0.4 + Math.random() * 0.6;
        const pos = startPos.add(worldDir.scale(len * t));
        pos.x += (Math.random() - 0.5) * 3.0;
        pos.z += (Math.random() - 0.5) * 3.0;
        pos.y += (Math.random() - 0.5) * 0.5;

        const leaf = this.createLeafDisk(scene);
        leaf.position.copyFrom(pos);
        leafMeshes.push(leaf);
      }
    }

    // Top canopy
    for (let i = 0; i < 15; i++) {
      const leaf = this.createLeafDisk(scene);
      leaf.position.y = height + (Math.random() - 0.5) * 2.0;
      leaf.position.x = (Math.random() - 0.5) * 10.0;
      leaf.position.z = (Math.random() - 0.5) * 10.0;
      leafMeshes.push(leaf);
    }

    // Merging
    if (woodMeshes.length > 0) {
      const mergedWood = Mesh.MergeMeshes(woodMeshes, true, true, undefined, false, true);
      if (mergedWood) {
        mergedWood.parent = root;
        mergedWood.material = Mangrove.getTrunkMaterial(scene);
      }
    }
    if (leafMeshes.length > 0) {
      const mergedLeaves = Mesh.MergeMeshes(leafMeshes, true, true, undefined, false, true);
      if (mergedLeaves) {
        mergedLeaves.parent = root;
        mergedLeaves.material = Mangrove.getLeafMaterial(scene);
      }
    }

    root.rotation.y = Math.random() * Math.PI * 2;
    this.sync();
  }

  private createLeafDisk(scene: Scene): Mesh {
    const radius = 2.0 + Math.random() * 1.5;
    const mesh = MeshBuilder.CreateCylinder("leaf", { height: 0.1, diameter: radius * 2, tessellation: 7 }, scene);

    // Irregularity via scaling and rotation
    mesh.scaling.x *= 0.7 + Math.random() * 0.6;
    mesh.scaling.z *= 0.7 + Math.random() * 0.6;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.rotation.x = (Math.random() - 0.5) * 0.1;
    mesh.rotation.z = (Math.random() - 0.5) * 0.1;

    return mesh;
  }

  update(dt: number): void { }

  private static getTrunkMaterial(scene: Scene): StandardMaterial {
    if (!this.trunkMaterial) {
      this.trunkMaterial = new StandardMaterial("mangroveTrunk", scene);
      this.trunkMaterial.diffuseColor = new Color3(0.4, 0.3, 0.2);
      this.trunkMaterial.specularColor = Color3.Black();
    }
    return this.trunkMaterial;
  }

  private static getLeafMaterial(scene: Scene): StandardMaterial {
    if (!this.leafMaterial) {
      this.leafMaterial = new StandardMaterial("mangroveLeaf", scene);
      this.leafMaterial.diffuseColor = new Color3(0.2, 0.3, 0.1);
      this.leafMaterial.specularColor = Color3.Black();
      this.leafMaterial.backFaceCulling = false;
    }
    return this.leafMaterial;
  }
}

