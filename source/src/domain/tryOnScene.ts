import scenes from '../data/tryOnScenes.json';
export type SceneId = 'original' | 'studio' | 'city' | 'coast' | 'evening' | 'custom';
export interface TryOnScene { id: SceneId; description?: string }
export const tryOnScenes = scenes as {id:SceneId;label:string;description:string;prompt:string}[];
export function sceneLabel(scene?: TryOnScene) { return tryOnScenes.find(s=>s.id===scene?.id)?.label ?? 'Original photo'; }
export function sceneValid(scene: TryOnScene) { return tryOnScenes.some(s=>s.id===scene.id) && (scene.id!=='custom'||!!scene.description?.trim()&&scene.description.length<=240); }
