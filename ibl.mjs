/**
 * PMREM IBL after classic scripts attach scene/renderer to window (no import() in game.js).
 */
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const THREE = window.THREE;
const scene = window.__TA_SCENE;
const renderer = window.__TA_RENDERER;
if (THREE && scene && renderer) {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    // Lower sigma = sharper env reflections on metals / gloss
    scene.environment = pmrem.fromScene(envScene, 0.018).texture;
    pmrem.dispose();
  } catch (err) {
    console.warn('IBL (PMREM) skipped:', err);
  }
}
