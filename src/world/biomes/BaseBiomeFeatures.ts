import { BiomeFeatures, SkyBiome } from './BiomeFeatures';
import { BiomeType } from './BiomeType';
import { PopulationContext } from './PopulationContext';
import { DecorationConfig, TerrainDecorator } from '../decorators/TerrainDecorator';
import { CoreMath } from '../../core/CoreMath';
import { BoatPathLayout, BoatPathLayoutConfig, BoatPathLayoutStrategy } from '../layout/BoatPathLayoutStrategy';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';
import { BoatPathLayoutSpawner } from '../layout/BoatPathLayoutSpawner';

export abstract class BaseBiomeFeatures implements BiomeFeatures {
    abstract id: BiomeType;

    protected index: number = 0;
    protected zMin: number = 0;
    protected zMax: number = 0;

    protected spatialGrid: SpatialGrid = new SpatialGrid(20);
    protected layoutCache: BoatPathLayout | null = null;

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

    protected getLayoutConfig(): BoatPathLayoutConfig | null {
        return null;
    }

    protected getLayout(): BoatPathLayout | null {
        if (this.layoutCache) return this.layoutCache;

        const config = this.getLayoutConfig();
        if (!config) return null;

        this.layoutCache = BoatPathLayoutStrategy.createLayout(
            [this.zMin, this.zMax], config, this.spatialGrid);
        return this.layoutCache;
    }

    public getDecorationConfig(): DecorationConfig | undefined {
        return undefined;
    }

    public * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // 1. Get entity layout creating it if needed
        const layout = this.getLayout();

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
                decorationConfig,
                { xMin: -250, xMax: 250, zMin: zStart, zMax: zEnd },
                spatialGrid,
                12345 + zStart
            );
        }

        // 3. Spawn
        if (layout) {
            yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
                context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
        }
    }
}
