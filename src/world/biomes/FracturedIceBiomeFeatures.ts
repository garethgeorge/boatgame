
import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { RiverSystem } from '../RiverSystem';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import Delaunator from 'delaunator';


import { PolarBearSpawner } from '../../entities/spawners/PolarBearSpawner';
import { IcebergSpawner } from '../../entities/spawners/IcebergSpawner';
import { PenguinKayakSpawner } from '../../entities/spawners/PenguinKayakSpawner';
import { FracturedIceberg } from '../../entities/obstacles/FracturedIceberg';

interface Point {
    x: number;
    y: number;
}

interface VoronoiCell {
    seed: Point;
    polygon: Point[];
    centroid: Point;
}

interface BiomeLayout {
    cells: VoronoiCell[];
    shrinkFactor?: number;
}

export class FracturedIceBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'fractured_ice' as BiomeType;

    private polarBearSpawner = new PolarBearSpawner();
    private penguinKayakSpawner = new PenguinKayakSpawner();
    private icebergSpawner = new IcebergSpawner();

    // Cache the material
    private static iceMaterial: THREE.Material | null = null;
    
    getGroundColor(): { r: number, g: number, b: number } {
        // slightly bluer/darker water under ice? 
        // actually this is ground color (river bed). Ice biome uses white-ish.
        return { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 400 };
    }

    getRiverWidthMultiplier(): number {
        // Ice biome was 2.3. Fractured ice needs space.
        return 5.0;
    }
    
    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color } {
        const colors = super.getSkyColors(dayness);
        if (dayness > 0) {
            const iceTopMod = new THREE.Color(0xddeeff); 
            const iceBotMod = new THREE.Color(0xffffff); 
            colors.top.lerp(iceTopMod, 0.8);
            colors.bottom.lerp(iceBotMod, 0.8);
        }
        return colors;
    }

    createLayout(length: number, zStart: number): BiomeLayout {
        const riverSystem = RiverSystem.getInstance();
        const boatWidth = 5.0; // Conservative boat width

        // Reduced density slightly since elongated cells cover more Z space effectively?
        // Or keep same. Let's keep same for now.
        let numSeeds = Math.floor(length / 8); 
        const maxAttempts = 20;

        // Anisotropic scaling factor. 
        // 0.4 means Z is compressed 2.5x.
        const zScale = 0.4; 

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Adjust shrink factor logic if needed. 
            // With elongated cells, gaps are anisotropic too.
            const shrinkFactor = Math.max(0.4, 0.85 - (attempt * 0.025));
            console.log(`[FracturedIce] Attempt ${attempt + 1}: Seeds ${numSeeds} | Shrink ${shrinkFactor.toFixed(2)}`);
            
            // 1. Generate Seeds
            const boundsX = 220;
            const seeds: Point[] = [];
            
            for (let i = 0; i < numSeeds; i++) {
                const z = Math.random() * length;
                const worldZ = z + zStart;
                
                const banks = riverSystem.getBankPositions(worldZ);
                const width = banks.right - banks.left;
                
                const padding = width * 0.1; 
                const safeWidth = width - 2 * padding;
                const x = banks.left + padding + Math.random() * safeWidth;
                
                seeds.push({ x, y: z });
            }

            // 2. Compute Voronoi in Scaled Space
            // Scale Z coords
            const scaledSeeds = seeds.map(s => ({ x: s.x, y: s.y * zScale }));

            const coords = new Float64Array(scaledSeeds.length * 2);
            for (let i = 0; i < scaledSeeds.length; i++) {
                coords[2 * i] = scaledSeeds[i].x;
                coords[2 * i + 1] = scaledSeeds[i].y;
            }

            const delaunay = new Delaunator(coords);
            const voronoi = this.computeVoronoi(scaledSeeds, seeds, delaunay, length, boundsX, zScale);

            // 3. Build Graph
            if (this.checkNavigability(voronoi, riverSystem, zStart, length, boatWidth, shrinkFactor)) {
                console.log(`[FracturedIce] Success on attempt ${attempt + 1}`);
                return { cells: voronoi.cells, shrinkFactor };
            }

            // Increase density
            numSeeds = Math.floor(numSeeds * 1.1);
        }

        console.warn("[FracturedIce] Failed to generate navigable layout after max attempts.");
        return { cells: [] }; 
    }

    private computeVoronoi(scaledSeeds: Point[], realSeeds: Point[], delaunay: Delaunator, length: number, boundsX: number, zScale: number) {
        // Reconstruct Voronoi cells from Delaunay
        
        const edges: { a: number, b: number, width: number }[] = []; 

        const circumcenters: Point[] = [];
        const triangles = delaunay.triangles;
        const numTriangles = triangles.length / 3;

        for (let t = 0; t < numTriangles; t++) {
            const i = triangles[3 * t];
            const j = triangles[3 * t + 1];
            const k = triangles[3 * t + 2];
            
            const p1 = scaledSeeds[i];
            const p2 = scaledSeeds[j];
            const p3 = scaledSeeds[k];
            
            circumcenters.push(this.getCircumcenter(p1, p2, p3));
        }

        // Unscale circumcenters to get world space graph nodes
        const graphNodes: Point[] = circumcenters.map(p => ({
            x: p.x,
            y: p.y / zScale
        }));

        const graphEdges: { u: number, v: number, seedA: number, seedB: number, width: number }[] = [];

        for (let e = 0; e < delaunay.halfedges.length; e++) {
            const eNext = delaunay.halfedges[e];
            if (eNext < e) continue; 

            const t1 = Math.floor(e / 3);
            const t2 = Math.floor(eNext / 3);

            if (t1 === -1 || t2 === -1) continue; 

            const seedAIdx = triangles[e];
            const seedBIdx = triangles[(e % 3 === 2) ? e - 2 : e + 1]; 
            
            // Use REAL seeds for physical width calculation
            const seedA = realSeeds[seedAIdx];
            const seedB = realSeeds[seedBIdx];
            
            const dist = Math.sqrt(Math.pow(seedA.x - seedB.x, 2) + Math.pow(seedA.y - seedB.y, 2));

            graphEdges.push({
                u: t1,
                v: t2,
                seedA: seedAIdx,
                seedB: seedBIdx,
                width: dist
            });
        }

        const cellPolygons: Point[][] = new Array(scaledSeeds.length).fill(null).map(() => []);
        
        const endpointToIncomingHalfedge = new Int32Array(scaledSeeds.length).fill(-1);
        for (let e = 0; e < delaunay.triangles.length; e++) {
            const endpoint = delaunay.triangles[this.nextHalfedge(e)];
            if (endpointToIncomingHalfedge[endpoint] === -1 || delaunay.halfedges[e] === -1) {
                 endpointToIncomingHalfedge[endpoint] = e;
            }
        }
        
        for (let i = 0; i < scaledSeeds.length; i++) {
            const start = endpointToIncomingHalfedge[i];
            if (start === -1) continue; 
            
            let e = start;
            const poly: Point[] = [];
            
            do {
                const t = Math.floor(e / 3);
                // Use unscaled graph nodes
                poly.push(graphNodes[t]); 
                
                const nextE = this.nextHalfedge(e); 
                if (delaunay.halfedges[nextE] === -1) break; 
                e = delaunay.halfedges[nextE];
                
            } while (e !== start);
            
            if (e === start && poly.length > 2) {
                cellPolygons[i] = poly;
            } else {
                cellPolygons[i] = [];
            }
        }

        return {
            cells: realSeeds.map((s, i) => ({
                seed: s,
                polygon: cellPolygons[i],
                centroid: s 
            })).filter(c => c.polygon.length > 0),
            graphNodes,
            graphEdges
        };
    }

    private checkNavigability(voronoi: any, riverSystem: RiverSystem, zStart: number, length: number, boatWidth: number, shrinkFactor: number): boolean {
        // Build Adjacency List
        const adj: Map<number, number[]> = new Map();
        const nodes = voronoi.graphNodes as Point[];
        const edges = voronoi.graphEdges as {u: number, v: number, width: number}[];

        // Filter Navigable Edges
        let edgesTotal = edges.length;
        let edgesWidth = 0;
        let edgesBank = 0;
        let edgesKept = 0;

        for (const e of edges) {
            // 1. Channel Width
            // Width of channel = Distance between seeds (e.width) * (1 - shrinkFactor)
            // Example: Dist 10, Shrink 0.7 -> Gap = 10 * 0.3 = 3.
            
            const gap = e.width * (1.0 - shrinkFactor);
            if (gap < boatWidth) {
                edgesWidth++;
                continue;
            }

            // 2. Bank Intersection
            const p1 = nodes[e.u];
            const p2 = nodes[e.v];
            
            // Check if points are in river
            // We check local Z + zStart
            if (!this.isInRiver(p1, riverSystem, zStart) || !this.isInRiver(p2, riverSystem, zStart)) {
                // If either node is outside/onbank, we consider the edge "blocked" or "pruned"
                edgesBank++;
                continue;
            }

            // Add to Graph
            if (!adj.has(e.u)) adj.set(e.u, []);
            if (!adj.has(e.v)) adj.set(e.v, []);
            adj.get(e.u)!.push(e.v);
            adj.get(e.v)!.push(e.u);
            edgesKept++;
        }

        const startNodes: number[] = [];
        const endNodes: Set<number> = new Set();
        
        for (let i = 0; i < nodes.length; i++) {
            const z = nodes[i].y;
            if (z < 30 && this.isInRiver(nodes[i], riverSystem, zStart)) startNodes.push(i);
            if (z > length - 30 && this.isInRiver(nodes[i], riverSystem, zStart)) endNodes.add(i);
        }

        console.log(`[FracturedIce] Graph: Total ${edgesTotal} | Width Fail ${edgesWidth} | Bank Fail ${edgesBank} | Kept ${edgesKept} | StartNodes ${startNodes.length} | EndNodes ${endNodes.size}`);

        if (startNodes.length === 0 || endNodes.size === 0) return false;

        const visited = new Set<number>();
        const queue = [...startNodes];
        startNodes.forEach(n => visited.add(n));

        while (queue.length > 0) {
            const curr = queue.shift()!;
            if (endNodes.has(curr)) return true; // Found path

            const neighbors = adj.get(curr);
            if (neighbors) {
                for (const n of neighbors) {
                    if (!visited.has(n)) {
                        visited.add(n);
                        queue.push(n);
                    }
                }
            }
        }

        return false;
    }

    private isInRiver(p: Point, riverSystem: RiverSystem, zStart: number): boolean {
        const worldZ = p.y + zStart;
        const banks = riverSystem.getBankPositions(worldZ);
        // Add a small buffer to avoid clipping banks
        const buffer = 0.5;
        return p.x > (banks.left + buffer) && p.x < (banks.right - buffer);
    }

    private getCircumcenter(a: Point, b: Point, c: Point): Point {
        const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(d) < 1e-6) return { x: (a.x+b.x+c.x)/3, y: (a.y+b.y+c.y)/3 }; // Collinear/Zero area fallback
        const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
        const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
        return { x: ux, y: uy };
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        // Decoration is now empty as icebergs are spawned as entities
        return;
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
       const boundarySize = 50.0;
       
       const fracturedStart = context.biomeZStart + boundarySize;
       const fracturedEnd = context.biomeZEnd - boundarySize;

       // 1. Spawn dynamic icebergs from layout
       const layout = context.biomeLayout;
       
       if (layout && layout.cells) {
            // Filter cells that are within the current chunk (zStart, zEnd)
            // AND are within the fractured ice region (fracturedStart, fracturedEnd)
            
            const cells = (layout.cells as VoronoiCell[]).filter(c => {
                const worldZ = c.centroid.y + context.biomeZStart; 
                if (worldZ < zStart || worldZ >= zEnd) return false;
                if (worldZ < fracturedStart || worldZ > fracturedEnd) return false;
                return true;
            });
            
            const shrinkFactor = layout.shrinkFactor || 0.7;

            for (const cell of cells) {
                const poly = cell.polygon;
                if (poly.length < 3) continue;

                const cx = cell.centroid.x;
                const cy = cell.centroid.y;

                const relativeVertices: {x: number, y: number}[] = [];
                
                for (const p of poly) {
                    const px = cx + (p.x - cx) * shrinkFactor;
                    const py = cy + (p.y - cy) * shrinkFactor;
                    relativeVertices.push({ x: px - cx, y: py - cy });
                }

                const worldX = cx;
                const worldZ = cy + context.biomeZStart; 

                const iceberg = new FracturedIceberg(worldX, worldZ, relativeVertices, context.physicsEngine);
                context.entityManager.add(iceberg, context.chunkIndex);
            }
       }

       // 2. Spawn Standard Boundary Icebergs
       // Start Boundary
       const startOverlapStart = Math.max(zStart, context.biomeZStart);
       const startOverlapEnd = Math.min(zEnd, fracturedStart);
       if (startOverlapStart < startOverlapEnd) {
           await this.icebergSpawner.spawn(context, Math.ceil((startOverlapEnd - startOverlapStart)/10), startOverlapStart, startOverlapEnd);
       }

       // End Boundary
       const endOverlapStart = Math.max(zStart, fracturedEnd);
       const endOverlapEnd = Math.min(zEnd, context.biomeZEnd);
       if (endOverlapStart < endOverlapEnd) {
           await this.icebergSpawner.spawn(context, Math.ceil((endOverlapEnd - endOverlapStart)/10), endOverlapStart, endOverlapEnd);
       }

       // 3. Spawn bears/penguins
       await this.spawnObstacle(this.penguinKayakSpawner, context, difficulty, zStart, zEnd);
       await this.spawnObstacle(this.polarBearSpawner, context, difficulty, zStart, zEnd);
    }

    private nextHalfedge(e: number): number {
        return (e % 3 === 2) ? e - 2 : e + 1;
    }
}
