export function selectPersistedTeam<T extends { id: string }>(
  teams: T[],
  persistedTeamId: string | null,
): T | null {
  return teams.find((team) => team.id === persistedTeamId) ?? teams[0] ?? null;
}

export function reconcileAuthorizedTeam<T extends { id: string }>(
  teams: T[],
  currentTeamId: string | null,
  persistedTeamId: string | null,
): T | null {
  return (
    teams.find((team) => team.id === currentTeamId) ?? selectPersistedTeam(teams, persistedTeamId)
  );
}
