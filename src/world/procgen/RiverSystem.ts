import * as THREE from 'three';
import { SplineMath } from './SplineMath';

export class RiverNode {
  position: THREE.Vector3;
  width: number;

  constructor(position: THREE.Vector3, width: number = 40) {
    this.position = position;
    this.width = width;
  }
}

export class RiverSegment {
  id: string;
  nodes: RiverNode[];
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh | null = null;
  colliderBodies: any[] = []; // Matter.js bodies
  active: boolean = true;

  constructor(id: string, nodes: RiverNode[]) {
    this.id = id;
    this.nodes = nodes;
    // Create curve from node positions
    // We need at least 2 points. CatmullRom needs 4 for full interpolation, 
    // or we can set closed=false and curveType='catmullrom'.
    // Three.js handles the control points internally if we pass the array.
    this.curve = new THREE.CatmullRomCurve3(nodes.map(n => n.position));
    this.curve.tension = 0.5;
  }

  getDistanceToCenterline(point: THREE.Vector3): number {
    // Approximate distance to the curve.
    // Exact distance to a spline is expensive.
    // We can sample points or find nearest point on the polyline of the curve.
    // For terrain generation, we need it to be reasonably fast.

    // Strategy: Find nearest point on the curve's sampled points.
    // Then refine? Or just use the sampled polyline distance.
    // Let's use 100 samples.
    const samples = this.curve.getSpacedPoints(20); // Low res for speed?
    let minDst = Infinity;

    for (let i = 0; i < samples.length - 1; i++) {
      const d = SplineMath.distanceToSegment(point, samples[i], samples[i + 1]);
      if (d < minDst) minDst = d;
    }
    return minDst;
  }
}

export class RiverSystem {
  segments: RiverSegment[] = [];
  activeHeads: RiverSegment[] = []; // The segments at the leading edge

  constructor() {
    // Initial segment
    const startNodes = [
      new RiverNode(new THREE.Vector3(0, 0, -50)),
      new RiverNode(new THREE.Vector3(0, 0, 0)),
      new RiverNode(new THREE.Vector3(0, 0, 50)),
      new RiverNode(new THREE.Vector3(0, 0, 100))
    ];
    const startSegment = new RiverSegment('seg_0', startNodes);
    this.segments.push(startSegment);
    this.activeHeads.push(startSegment);
  }

  update(playerPos: THREE.Vector3) {
    // Generate new segments if player is close to end of a head
    const generationDistance = 200;

    for (let i = this.activeHeads.length - 1; i >= 0; i--) {
      const head = this.activeHeads[i];
      const lastNode = head.nodes[head.nodes.length - 1];

      if (playerPos.distanceTo(lastNode.position) < generationDistance) {
        this.extendSegment(head);
      }
    }

    // Cull old segments
    const cullDistance = 300;
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const lastNode = seg.nodes[seg.nodes.length - 1];
      // Simple cull: if the END of the segment is far behind player
      // Assuming player moves +Z generally? No, river winds.
      // Check distance to closest point on segment?
      // Or just check centroid.
      const center = seg.nodes[Math.floor(seg.nodes.length / 2)].position;
      if (center.distanceTo(playerPos) > cullDistance && center.z < playerPos.z - 100) { // Very rough culling
        // Mark for removal (handled by game loop)
        seg.active = false;
      }
    }
  }

  extendSegment(head: RiverSegment) {
    // Simple logic: Create a new segment attached to the end of the head
    const lastNode = head.nodes[head.nodes.length - 1];
    const prevNode = head.nodes[head.nodes.length - 2];

    // Calculate direction
    const dir = lastNode.position.clone().sub(prevNode.position).normalize();

    // Random turn (gentle meander)
    // Clamp angle to avoid loops
    const angle = (Math.random() - 0.5) * 0.5; // Reduced from 1.0 to 0.5 for gentler turns
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);

    // Ensure we generally move forward (optional, but good for gameplay)
    // If dir.z is negative (assuming -Z is forward), keep it negative.
    // Actually, let's just let it wander but maybe bias towards -Z?
    // For now, just random walk with momentum is fine.

    const dist = 50;
    const newPos = lastNode.position.clone().add(dir.multiplyScalar(dist));

    // Just extend the current head
    head.nodes.push(new RiverNode(newPos));

    // Rebuild curve
    // Note: Rebuilding the whole curve every time is inefficient for long segments.
    // Better to have fixed-size segments and spawn NEW segments.
    // But for "single river", extending one giant segment is easiest for continuity, 
    // until it gets too big.
    // Let's cap segment size and spawn a new linked segment if too big.

    if (head.nodes.length > 20) {
      this.startNewSegment(head);
    } else {
      head.curve = new THREE.CatmullRomCurve3(head.nodes.map(n => n.position));
    }
  }

  startNewSegment(prevSegment: RiverSegment) {
    // Start a new segment connected to the end of the previous one
    // We need overlap or perfect continuity.
    // Catmull-Rom needs control points.
    // To ensure smooth transition, the new segment should start with the last few points of the old one.

    const overlap = 3; // Number of points to overlap
    const startNodes = prevSegment.nodes.slice(-overlap).map(n => new RiverNode(n.position.clone()));

    // Mark previous as no longer active head (but still active for rendering/physics until culled)
    const index = this.activeHeads.indexOf(prevSegment);
    if (index > -1) this.activeHeads.splice(index, 1);

    const newSegment = new RiverSegment('seg_' + this.segments.length, startNodes);
    this.segments.push(newSegment);
    this.activeHeads.push(newSegment);
  }

  getNearestSegments(pos: THREE.Vector3, radius: number): RiverSegment[] {
    return this.segments.filter(s => {
      // Simple bounding box or distance check
      // Check distance to first node for now
      // Optimization: check if segment is roughly within range
      if (!s.active) return false;
      const dist = s.nodes[0].position.distanceTo(pos);
      return dist < radius + 500; // Increased range
    });
  }
}
