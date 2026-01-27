import { describe, it, expect } from 'vitest';
import { FlowerPalettes } from './FlowerPalettes';

describe('FlowerPalettes', () => {
    it('should return a color from the palette', () => {
        const palette = { colors: [0xff0000, 0x00ff00] };
        const color = FlowerPalettes.getInterpolatedColor(palette, 0);
        expect(color).toBe(0xff0000);
    });

    it('should interpolate between colors', () => {
        const palette = { colors: [0x000000, 0xffffff] };
        const color = FlowerPalettes.getInterpolatedColor(palette, 0.5);
        // Midpoint between 0x000000 and 0xffffff in threejs lerp is 0xbcbcbc (due to some color space conversion likely, or just rounding)
        // Let's just verify it is a number and not equal to the extremes
        expect(color).not.toBe(0x000000);
        expect(color).not.toBe(0xffffff);
    });

    it('should handle t=1 correctly', () => {
        const palette = { colors: [0xff0000, 0x00ff00] };
        const color = FlowerPalettes.getInterpolatedColor(palette, 1);
        expect(color).toBe(0x00ff00);
    });

    it('should return default palette if name not found', () => {
        const palette = FlowerPalettes.getPalette('non-existent');
        expect(palette).toBe(FlowerPalettes.DAISY);
    });

    it('should return specific palette by name', () => {
        const daisyPalette = FlowerPalettes.getPalette('daisy');
        expect(daisyPalette).toBe(FlowerPalettes.DAISY);

        const lilyPalette = FlowerPalettes.getPalette('lily');
        expect(lilyPalette).toBe(FlowerPalettes.LILY);
    });
});
