export class ScreenOverlay {
    private element: HTMLDivElement;
    private rendererDomElement: HTMLCanvasElement;

    constructor(container: HTMLElement, rendererDomElement: HTMLCanvasElement) {
        this.rendererDomElement = rendererDomElement;

        this.element = document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.top = '0';
        this.element.style.left = '0';
        this.element.style.width = '100%';
        this.element.style.height = '100%';
        this.element.style.pointerEvents = 'none';
        this.element.style.zIndex = '10';
        this.element.style.transition = 'background-color 1s ease';
        this.element.style.mixBlendMode = 'overlay';
        container.appendChild(this.element);
    }

    update(weights: { desert: number, forest: number, ice: number }) {
        // Desert: Sepia/Warm
        // Forest: Cool Blue
        // Ice: Cold Cyan/White

        const desertColor = { r: 180, g: 140, b: 100, a: 0.15 };
        const forestColor = { r: 100, g: 150, b: 200, a: 0.15 };
        const iceColor = { r: 200, g: 240, b: 255, a: 0.20 };

        const r = desertColor.r * weights.desert + forestColor.r * weights.forest + iceColor.r * weights.ice;
        const g = desertColor.g * weights.desert + forestColor.g * weights.forest + iceColor.g * weights.ice;
        const b = desertColor.b * weights.desert + forestColor.b * weights.forest + iceColor.b * weights.ice;
        const a = desertColor.a * weights.desert + forestColor.a * weights.forest + iceColor.a * weights.ice;

        this.element.style.backgroundColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;

        // Update Desaturation (CSS Filter)
        const grayscale = weights.ice * 0.9;
        this.rendererDomElement.style.filter = `grayscale(${grayscale})`;
    }
}
