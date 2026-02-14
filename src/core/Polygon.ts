import * as planck from 'planck';

/**
 * Utility for 2D polygon operations.
 */
export class Polygon {
    private vertices: planck.Vec2[];

    constructor(vertices: planck.Vec2[]) {
        this.vertices = vertices;
    }

    /**
     * Checks if a point is inside the polygon using the ray-casting algorithm.
     */
    public containsPoint(point: planck.Vec2): boolean {
        let inside = false;
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const xi = this.vertices[i].x, yi = this.vertices[i].y;
            const xj = this.vertices[j].x, yj = this.vertices[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Calculates the shortest distance from a point to the polygon's boundary.
     */
    public distanceToPoint(point: planck.Vec2): number {
        let minDistanceSq = Infinity;

        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const v1 = this.vertices[i];
            const v2 = this.vertices[j];

            const distSq = this.pointToSegmentDistanceSq(point, v1, v2);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
            }
        }

        return Math.sqrt(minDistanceSq);
    }

    private pointToSegmentDistanceSq(p: planck.Vec2, v: planck.Vec2, w: planck.Vec2): number {
        const l2 = planck.Vec2.distanceSquared(v, w);
        if (l2 === 0) return planck.Vec2.distanceSquared(p, v);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return planck.Vec2.distanceSquared(p, planck.Vec2(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y)));
    }
}
