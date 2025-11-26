import * as THREE from 'three';

export class SplineMath {
  // Catmull-Rom interpolation
  // p0, p1, p2, p3 are control points. t is between 0 and 1 (between p1 and p2).
  // alpha is knot parameterization (0.5 for centripetal is good for avoiding loops)
  static catmullRom(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, alpha: number = 0.5): THREE.Vector3 {
    const t0 = 0;
    const t1 = this.getT(t0, p0, p1, alpha);
    const t2 = this.getT(t1, p1, p2, alpha);
    const t3 = this.getT(t2, p2, p3, alpha);

    const tInterp = t1 + (t2 - t1) * t;

    const A1 = p0.clone().multiplyScalar((t1 - tInterp) / (t1 - t0)).add(p1.clone().multiplyScalar((tInterp - t0) / (t1 - t0)));
    const A2 = p1.clone().multiplyScalar((t2 - tInterp) / (t2 - t1)).add(p2.clone().multiplyScalar((tInterp - t1) / (t2 - t1)));
    const A3 = p2.clone().multiplyScalar((t3 - tInterp) / (t3 - t2)).add(p3.clone().multiplyScalar((tInterp - t2) / (t3 - t2)));

    const B1 = A1.clone().multiplyScalar((t2 - tInterp) / (t2 - t0)).add(A2.clone().multiplyScalar((tInterp - t0) / (t2 - t0)));
    const B2 = A2.clone().multiplyScalar((t3 - tInterp) / (t3 - t1)).add(A3.clone().multiplyScalar((tInterp - t1) / (t3 - t1)));

    const C = B1.clone().multiplyScalar((t2 - tInterp) / (t2 - t1)).add(B2.clone().multiplyScalar((tInterp - t1) / (t2 - t1)));

    return C;
  }

  static getT(t: number, p0: THREE.Vector3, p1: THREE.Vector3, alpha: number): number {
    const a = Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2) + Math.pow(p1.z - p0.z, 2);
    const b = Math.pow(a, alpha * 0.5);
    return b + t;
  }

  // Simple Catmull-Rom (Uniform) for easier implementation if needed, but Centripetal is better.
  // Let's stick to Three.js built-in Curve if possible? 
  // Three.js has CatmullRomCurve3. We can use that for segments.
  // But for infinite generation, we often do it manually.
  // Let's use Three.js CatmullRomCurve3 for each segment defined by 4 points.

  // Distance from point P to line segment AB
  static distanceToSegment(P: THREE.Vector3, A: THREE.Vector3, B: THREE.Vector3): number {
    const AB = B.clone().sub(A);
    const AP = P.clone().sub(A);
    const lenSq = AB.lengthSq();
    if (lenSq === 0) return AP.length(); // A and B are same

    // Project P onto AB, computing param t
    let t = AP.dot(AB) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to segment

    // Closest point
    const closest = A.clone().add(AB.multiplyScalar(t));
    return P.distanceTo(closest);
  }
}
