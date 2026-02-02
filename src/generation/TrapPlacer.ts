/**
 * Trap type definitions used by the level loader and game scene
 */

export type TrapType =
  | 'collapsing'
  | 'spike'
  | 'crushing'
  | 'laser'
  | 'teleport'
  | 'gravity'
  | 'moving'
  | 'bounce'
  | 'fakefloor'
  | 'sawblade'
  | 'ice'
  | 'fakegoal'
  | 'wallofdeath'
  | 'risinglava'
  | 'mirrorenemy'
  | 'fakespike'
  | 'movinggoal'
  | 'invertingroom';

export interface TrapPlacement {
  type: TrapType;
  gridX: number;
  gridY: number;
  config?: Record<string, unknown>;
}
