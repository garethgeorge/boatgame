import { BiomeFeatures, SkyBiome } from './BiomeFeatures';
import { BiomeType } from './BiomeType';
import { PopulationContext } from './PopulationContext';
import { TerrainDecorator } from '../decorators/TerrainDecorator';
import { CoreMath } from '../../core/CoreMath';
import { BoatPathLayout, BoatPathLayoutConfig, BoatPathLayoutStrategy } from '../layout/BoatPathLayoutStrategy';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';
import { BoatPathLayoutSpawner } from '../layout/BoatPathLayoutSpawner';
import { RiverSystem } from '../RiverSystem';
import { DecorationConfig, NoiseMap } from './DecorationConfig';
import { WorldParams } from '../decorators/WorldParams';
import { WorldMap } from '../decorators/PoissonDecorationStrategy';
import { SimplexNoise } from '../../core/SimplexNoise';

class BiomeWorldParams implements WorldParams {

    public riverSystem: RiverSystem;
    public biomeZRange: [number, number];

    private _maps: Record<string, WorldMap>;
    private _noise2D: SimplexNoise;

    constructor(river: RiverSystem, zmin: number, zmax: number,
        maps: Record<string, WorldMap>) {
        this.riverSystem = river;
        this.biomeZRange = [zmin, zmax];
        this._maps = maps;
        this._noise2D = new SimplexNoise;
    }

    public terrainProvider(x: number, z: number) {
        const height = this.riverSystem.terrainGeometry.calculateHeight(x, z);
        const normal = this.riverSystem.terrainGeometry.calculateNormal(x, z);

        // Approximate distToRiver logic
        const riverCenter = this.riverSystem.getRiverCenter(z);
        const distToCenter = Math.abs(x - riverCenter);
        const riverWidth = this.riverSystem.getRiverWidth(z);
        const distToRiver = distToCenter - riverWidth / 2;

        // Slope calculation (angle in radians)
        const slope = Math.acos(Math.max(-1, Math.min(1, normal.y)));

        return { height, slope, distToRiver };
    }

    public random() {
        return Math.random();
    }

    public gaussian = CoreMath.createGaussianRNG(Math.random);

    public noise2D(x, y) {
        return this._noise2D.noise2D(x, y);
    }

    public sampleMap(name: string, x: number, z: number) {
        const map = this._maps[name];
        if (!map) return 0;
        return map.sample(x, z);
    }
}

export abstract class BaseBiomeFeatures implements BiomeFeatures {
    abstract id: BiomeType;

    protected index: number = 0;
    protected zMin: number = 0;
    protected zMax: number = 0;

    private spatialGrid: SpatialGrid = new SpatialGrid(20);
    private worldParams: WorldParams | null = null;
    private layout: BoatPathLayout | null = null;
    private decorationConfig: DecorationConfig | null = null;

    /**
     * If index is < 0 the z value is the end of the biome if > 0 it is the start
     */
    constructor(index: number, z: number, length: number, direction: number) {
        this.index = index;
        if (direction < 0) {
            this.zMax = z;
            this.zMin = z - length;
        } else {
            this.zMin = z;
            this.zMax = z + length;
        }
    }

    getRange(): { zMin: number, zMax: number } {
        return { zMin: this.zMin, zMax: this.zMax };
    }

    getFogDensity(): number {
        return 0.0;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 100, far: 800 };
    }

    abstract getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number };

    abstract getScreenTint(): { r: number, g: number, b: number };

    public getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x4488ff, bottom: 0xccddff },
            sunset: { top: 0x967BB6, bottom: 0xFF9966 },
            night: { top: 0x1A1A3A, bottom: 0x2D2D44 },
            haze: 0.5
        };
    }

    public getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        // Apply Bank Taper: Force land height to 0 at the river edge
        // Smoothly ramp up over 15 units
        const bankTaper = CoreMath.smoothstep(0, 15, distFromBank);
        return bankTaper;
    }

    public getRiverWidthMultiplier(): number {
        return 1.0;
    }

    public createWorldMaps(): Record<string, NoiseMap> {
        return {};
    }

    public createDecorationConfig(): DecorationConfig {
        return null;
    }

    public createLayoutConfig(): BoatPathLayoutConfig {
        return null;
    }

    public getWorldParams(): WorldParams {
        if (!this.worldParams) {
            this.worldParams = new BiomeWorldParams(
                RiverSystem.getInstance(),
                this.zMin, this.zMax,
                this.createWorldMaps()
            );
        }
        return this.worldParams;
    }

    public getDecorationConfig(): DecorationConfig | undefined {
        if (!this.decorationConfig) {
            this.decorationConfig = this.createDecorationConfig();
        }
        return this.decorationConfig;
    }

    public * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {

        // 0. Get/Create world params
        const worldParams = this.getWorldParams();

        // 1. Create layout if not yet done
        if (!this.layout) {
            const layoutConfig = this.createLayoutConfig();
            if (layoutConfig) {
                this.layout = BoatPathLayoutStrategy.createLayout(
                    worldParams, layoutConfig, this.spatialGrid);
            }
        }
        const layout = this.layout;

        // 2. Decorate
        const decorationConfig = this.getDecorationConfig();
        if (decorationConfig) {
            // decorations are inserted into the chunk grid but checked for
            // collisions against the layout grid for the entire biome
            const spatialGrid = new SpatialGridPair(
                context.chunk.spatialGrid,
                this.spatialGrid
            );

            yield* TerrainDecorator.decorateIterator(
                context,
                worldParams,
                decorationConfig.rules,
                { xMin: -250, xMax: 250, zMin: zStart, zMax: zEnd },
                layout?.requirements || null,
                spatialGrid
            );
        }

        // 3. Spawn
        if (layout) {
            yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
                context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
        }
    }
}
