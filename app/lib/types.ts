export type MissionState =
  | 'IDLE'
  | 'MISSION'
  | 'DRONE_DEPLOY'
  | 'DRONE'
  | 'SCANNING'
  | 'POINT_CLOUD'
  | 'RECONSTRUCT'
  | 'SURVIVORS_DETECTED'
  | 'PLANNING'
  | 'ROUTE'
  | 'ROUTE_GENERATED'
  | 'RESCUE_SIM'
  | 'COMPLETE'
  | 'REPLAY'
  | 'AR'
  | 'AUTO_SEARCH'
  | 'THERMAL'
  | 'SWARM';
export type DisasterType = 'earthquake' | 'flood' | 'fire';
export type Priority = 'High' | 'Medium' | 'Low';
export type Vec2 = { x: number; z: number };
export type SurvivorBehavior = 'walk' | 'sit' | 'lie' | 'wave' | 'hide' | 'limp';
export type Survivor = {
  id: number;
  base: Vec2;
  health: number;
  priority: Priority;
  behavior: SurvivorBehavior;
  hidden: boolean;
  foundByLidar: boolean;
  foundByThermal: boolean;
};
export type SwarmDrone = {
  id: string;
  name: string;
  color: string;
  role: 'lidar' | 'thermal' | 'mapping';
  status: string;
  pos: Vec2;
  path: Vec2[];
  pathIdx: number;
  progress: number;
};
export type DroneState = 'idle' | 'deploying' | 'ready' | 'scanning' | 'mission';
export type RouteMode = 'safest' | 'fastest' | 'balanced';
