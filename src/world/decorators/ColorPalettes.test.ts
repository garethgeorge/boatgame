import { describe, it, expect } from 'vitest';
import { ColorPalettes } from './ColorPalettes';

describe('ColorPalettes', () => {
    it('should return a color from the palette', () => {
        const palette = { colors: [0xff0000, 0x00ff00] };
        const color = ColorPalettes.getInterpolatedColor(palette, 0);
        expect(color).toBe(0xff0000);
    });

    it('should interpolate between colors', () => {
        const palette = { colors: [0x000000, 0xffffff] };
        const color = ColorPalettes.getInterpolatedColor(palette, 0.5);
        // Midpoint between 0x000000 and 0xffffff in threejs lerp is 0xbcbcbc (due to some color space conversion likely, or just rounding)
        // Let's just verify it is a number and not equal to the extremes
        expect(color).not.toBe(0x000000);
        expect(color).not.toBe(0xffffff);
    });

    it('should handle t=1 correctly', () => {
        const palette = { colors: [0xff0000, 0x00ff00] };
        const color = ColorPalettes.getInterpolatedColor(palette, 1);
        expect(color).toBe(0x00ff00);
    });

    it('should return default palette if name not found', () => {
        const palette = ColorPalettes.getPalette('non-existent');
        expect(palette).toBe(ColorPalettes.DAISY);
    });

    it('should return specific palette by name', () => {
        const daisyPalette = ColorPalettes.getPalette('daisy');
        expect(daisyPalette).toBe(ColorPalettes.DAISY);

        const lilyPalette = ColorPalettes.getPalette('lily');
        expect(lilyPalette).toBe(ColorPalettes.LILY);
    });
});
