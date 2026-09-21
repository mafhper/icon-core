export { TARGET_REGISTRY } from './targets';
export type { TargetDefinition } from './targets';
export { buildTargetPlan } from './planner';
export type { RasterTask, ManifestEntry, TargetPlan } from './planner';
export { migrateV1ToV2, migrateV2ToV3, migrateToCurrent } from './migration';
export type { IconCoreProjectV2 } from './migration';