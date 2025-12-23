
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { GraphicsTracker, DisposableResource } from './GraphicsTracker';

describe('GraphicsTracker', () => {
    let tracker: GraphicsTracker;

    beforeEach(() => {
        tracker = new GraphicsTracker();
        tracker.verbose = false;
    });

    it('should track and retain a resource', () => {
        const geometry = new THREE.BufferGeometry();
        geometry.name = 'TestGeo';

        // Access private method for testing via any cast
        (tracker as any).retain(geometry);

        const count = (tracker as any).trackedResources.get(geometry);
        expect(count).toBe(1);
    });

    it('should increment reference count on multiple retains', () => {
        const material = new THREE.MeshBasicMaterial();
        const t = tracker as any;

        t.retain(material);
        t.retain(material);

        expect(t.trackedResources.get(material)).toBe(2);
    });

    it('should dispose resource when count drops to zero', () => {
        const texture = new THREE.Texture();
        const disposeSpy = vi.spyOn(texture, 'dispose');
        const t = tracker as any;

        t.retain(texture);
        expect(t.trackedResources.get(texture)).toBe(1);

        t.release(texture);
        expect(t.trackedResources.has(texture)).toBe(false); // Should be removed from map
        expect(disposeSpy).toHaveBeenCalled();
    });

    it('should not dispose resource if count is still positive', () => {
        const geometry = new THREE.BoxGeometry();
        const disposeSpy = vi.spyOn(geometry, 'dispose');
        const t = tracker as any;

        t.retain(geometry);
        t.retain(geometry);
        t.release(geometry);

        expect(t.trackedResources.get(geometry)).toBe(1);
        expect(disposeSpy).not.toHaveBeenCalled();
    });

    it('should recursively track resources in a mesh', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, material);

        tracker.track(mesh);

        const t = tracker as any;
        expect(t.trackedResources.get(geometry)).toBe(1);
        expect(t.trackedResources.get(material)).toBe(1);
        expect(t.trackedLeaves.has(mesh)).toBe(true);
    });

    it('should recursively release resources in a mesh', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        const geoDispose = vi.spyOn(geometry, 'dispose');
        const matDispose = vi.spyOn(material, 'dispose');

        tracker.track(mesh);
        tracker.untrack(mesh);

        const t = tracker as any;
        expect(t.trackedResources.has(geometry)).toBe(false);
        expect(t.trackedResources.has(material)).toBe(false);
        expect(geoDispose).toHaveBeenCalled();
        expect(matDispose).toHaveBeenCalled();
    });

    it('should add mesh to tracked leaves when tracked', () => {
        const mesh = new THREE.Mesh();
        const t = tracker as any;

        tracker.track(mesh);

        expect(t.trackedLeaves.has(mesh)).toBe(true);
    });

    it('should remove mesh from tracked leaves when untracked', () => {
        const mesh = new THREE.Mesh();
        const t = tracker as any;

        tracker.track(mesh);
        expect(t.trackedLeaves.has(mesh)).toBe(true);

        tracker.untrack(mesh);
        expect(t.trackedLeaves.has(mesh)).toBe(false);
    });

    it('should only increment resource counts once when track is called multiple times for the same mesh', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        const t = tracker as any;

        tracker.track(mesh);
        tracker.track(mesh);
        tracker.track(mesh);

        // Should still be tracked as a leaf
        expect(t.trackedLeaves.has(mesh)).toBe(true);

        // Resources should only be retained ONCE
        expect(t.trackedResources.get(geometry)).toBe(1);
        expect(t.trackedResources.get(material)).toBe(1);
    });

    it('should dispose resources when untrack is called after multiple track calls', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        const geoDispose = vi.spyOn(geometry, 'dispose');

        tracker.track(mesh);
        tracker.track(mesh); // Duplicate call

        tracker.untrack(mesh); // Single untrack should clean up

        const t = tracker as any;
        expect(t.trackedLeaves.has(mesh)).toBe(false);
        expect(geoDispose).toHaveBeenCalled();
        expect(t.trackedResources.has(geometry)).toBe(false);
    });
});
