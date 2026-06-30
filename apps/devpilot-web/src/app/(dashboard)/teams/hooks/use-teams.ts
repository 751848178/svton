/**
 * 团队列表 Hook
 *
 * 单一职责：团队列表的取数与创建/删除，委托到全局共享的 TeamService（@svton/service）。
 *
 * 关键设计：团队数据是跨页面共享状态——layout 的 team-switcher 与本列表页必须同源。
 * 故本 hook 不另开 SWR 缓存，而是直接消费 useTeamStore()：
 *   - 首屏 server 数据 initialTeams 直接作为列表展示（store 无公开 seedTeams，
 *     且 currentTeam/cookie 同步由 switcher 在其自身 mount 时处理）；
 *   - 创建/删除走 store 的 createTeam/deleteTeam（会同步 currentTeam + cookie，
 *     保证列表页与 switcher 一致）。
 */

import { useTeamStore } from '@/store/hooks';
import type { Team } from '@/types/api-registry';

export function useTeams(initialTeams?: Team[]) {
  const { teams, isLoading, error, createTeam, deleteTeam, fetchTeams } = useTeamStore();

  // store 已有数据时用 store；否则回退到 server 下发的 initialTeams（首屏直出）。
  // 当 client 后续发生增删时，store.teams 会更新并自然接管展示。
  const displayTeams = teams.length > 0 ? teams : initialTeams ?? [];

  return {
    teams: displayTeams,
    loading: isLoading,
    error: error ?? '',
    create: createTeam,
    remove: deleteTeam,
    refresh: fetchTeams,
  };
}
