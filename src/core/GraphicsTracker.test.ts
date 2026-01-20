
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

    it('should identify leaked objects correctly', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const now = 10000;
        vi.spyOn(performance, 'now').mockReturnValue(now);

        const meshOldCached = new THREE.Mesh();
        meshOldCached.name = 'OldCachedMesh';
        const meshLeaked = new THREE.Mesh();
        meshLeaked.name = 'LeakedMesh';
        const meshNew = new THREE.Mesh();
        meshNew.name = 'NewMesh';

        // 1. Setup Baseline - Cached Object
        tracker.track(meshOldCached);
        tracker.markAsCache(meshOldCached); // Explicitly mark as cache

        // 2. Add a "leak" (simulated by time passing)
        // Set time for the leaked object creation
        const leakTime = now + 1000;
        vi.spyOn(performance, 'now').mockReturnValue(leakTime);
        tracker.track(meshLeaked);

        // 3. Add a "new" object (simulated as very recent)
        const newTime = now + 5000;
        vi.spyOn(performance, 'now').mockReturnValue(newTime);
        tracker.track(meshNew);

        // 4. Check for leaks at a later time
        const checkTime = now + 6000;
        vi.spyOn(performance, 'now').mockReturnValue(checkTime);

        // We check for leaks older than 2 seconds
        // meshLeaked age = 6000 - 1000 = 5000ms = 5s (Should be caught)
        // meshNew age = 6000 - 5000 = 1000ms = 1s (Should be ignored)

        tracker.checkLeaks(2);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Potential Leak:'),
            expect.stringContaining('LeakedMesh'),
            expect.any(Object),
            expect.any(String), // Age string
            expect.any(String)  // Age value
        );

        // Verify "NewMesh" was NOT logged
        const calls = consoleSpy.mock.calls.map(args => args.join(' '));
        const leakedLog = calls.find(call => call.includes('LeakedMesh'));
        const newLog = calls.find(call => call.includes('NewMesh'));
        const oldLog = calls.find(call => call.includes('OldCachedMesh'));

        expect(leakedLog).toBeDefined();
        expect(newLog).toBeUndefined();
        expect(oldLog).toBeUndefined(); // Should be ignored as cached
    });

    it('should ignore objects marked as cache', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const now = 10000;
        vi.spyOn(performance, 'now').mockReturnValue(now);

        const cachedObject = new THREE.Mesh();
        cachedObject.name = 'CachedMesh';

        // 1. Mark as cache (which tracks it)
        tracker.markAsCache(cachedObject);

        // 2. Advance time significantly
        const checkTime = now + 10000;
        vi.spyOn(performance, 'now').mockReturnValue(checkTime);

        // 3. Check for leaks
        tracker.checkLeaks(2);

        // 4. Verify NOT logged
        const calls = consoleSpy.mock.calls.map(args => args.join(' '));
        const leakedLog = calls.find(call => call.includes('CachedMesh'));
        expect(leakedLog).toBeUndefined();
    });

    it('should ignore objects attached to scene root', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const now = 10000;
        vi.spyOn(performance, 'now').mockReturnValue(now);

        const scene = new THREE.Scene();
        const objectInScene = new THREE.Mesh();
        objectInScene.name = 'SceneObject';
        scene.add(objectInScene);

        const objectLeaked = new THREE.Mesh();
        objectLeaked.name = 'LeakedMesh2';

        // 1. Track both
        tracker.track(objectInScene);
        tracker.track(objectLeaked);

        // 2. Advance time
        const checkTime = now + 10000;
        vi.spyOn(performance, 'now').mockReturnValue(checkTime);

        // 3. Check for leaks, passing scene
        tracker.checkLeaks(2, false, scene);

        // 4. Verify
        const calls = consoleSpy.mock.calls.map(args => args.join(' '));
        const sceneLog = calls.find(call => call.includes('SceneObject'));
        const leakedLog = calls.find(call => call.includes('LeakedMesh2'));

        expect(sceneLog).toBeUndefined(); // Should be ignored because it's in scene
        expect(leakedLog).toBeDefined(); // Should be leaked
    });

    it('should identify untracked objects in the scene', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => { });
        const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => { });
        const now = 10000;
        vi.spyOn(performance, 'now').mockReturnValue(now);

        const scene = new THREE.Scene();

        // Create a mesh DIRECTLY (bypassing tracker)
        const untrackedMesh = new THREE.Mesh();
        untrackedMesh.name = 'BadMesh';
        scene.add(untrackedMesh);

        // Track a good mesh
        const trackedMesh = new THREE.Mesh();
        trackedMesh.name = 'GoodMesh';
        tracker.track(trackedMesh);
        scene.add(trackedMesh);

        // Check leaks
        tracker.checkLeaks(2, false, scene);

        // Verify warning
        const warnCalls = consoleSpy.mock.calls.map(args => args.join(' '));
        const untrackedLog = warnCalls.find(call => call.includes('Untracked object found in scene') && call.includes('BadMesh'));

        const errorCalls = consoleErrorSpy.mock.calls.map(args => args.join(' '));
        const summaryLog = errorCalls.find(call => call.includes('objects in scene that are NOT tracked'));

        expect(untrackedLog).toBeDefined();
        expect(summaryLog).toBeDefined();
    });
});
