import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', async () => {
    const game = new Game();
    await game.preload();
    await game.init();
});
