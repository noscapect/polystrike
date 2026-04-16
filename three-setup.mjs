/**
 * ONE ES-module THREE for the whole app (no three.min.js — avoids UMD/ESM GLTF mismatch).
 * Addons load after THREE is on window; failures are non-fatal (procedural bots).
 */
import * as THREE from 'three';

window.THREE = THREE;

try {
  const [{ GLTFLoader }, { SkeletonUtils }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/utils/SkeletonUtils.js'),
  ]);
  window.GLTFLoader = GLTFLoader;
  window.SkeletonUtils = SkeletonUtils;
} catch (err) {
  console.warn('three-setup: GLTFLoader / SkeletonUtils failed (procedural bots).', err);
}
