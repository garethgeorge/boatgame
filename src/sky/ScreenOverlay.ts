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

    update(color: { r: number, g: number, b: number }, desaturation: number) {
        this.element.style.backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`;
        this.rendererDomElement.style.filter = `grayscale(${desaturation})`;
    }

}
