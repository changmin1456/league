export const computeMatchKda = (kills, deaths, assists) =>
  deaths === 0 ? kills + assists : (kills + assists) / deaths

export const buildLeaderboardRows = (rows) => {
  const grouped = new Map()
  for (const row of rows) {
    const key = row.riot_id_normalized
    const list = grouped.get(key) ?? []
    list.push(row)
    grouped.set(key, list)
  }

  const result = []
  for (const [riotKey, list] of grouped.entries()) {
    if (!list.length) continue
    const sortedByTimeDesc = [...list].sort((a, b) => {
      if (b.game_creation !== a.game_creation) return b.game_creation - a.game_creation
      return b.match_id.localeCompare(a.match_id)
    })
    const games = list.length
    const wins = list.reduce((sum, item) => sum + (item.win === 1 ? 1 : 0), 0)
    const losses = games - wins
    const totalKda = list.reduce((sum, item) => sum + computeMatchKda(item.kills, item.deaths, item.assists), 0)
    const avgKda = games > 0 ? Number((totalKda / games).toFixed(2)) : 0
    const peakDamage = list.reduce((max, item) => Math.max(max, Number(item.damage ?? 0)), 0)

    const firstWin = sortedByTimeDesc[0]?.win === 1
    let streakCount = 0
    for (const row of sortedByTimeDesc) {
      const isWin = row.win === 1
      if (isWin !== firstWin) break
      streakCount += 1
    }

    const profileIconId = sortedByTimeDesc.find((item) => typeof item.profile_icon_id === 'number' && item.profile_icon_id > 0)?.profile_icon_id ?? null

    result.push({
      riotKey,
      riotId: sortedByTimeDesc[0].riot_id,
      profileIconId,
      games,
      wins,
      losses,
      winRate: games > 0 ? Number(((wins / games) * 100).toFixed(2)) : 0,
      avgKda,
      peakDamage,
      streakType: games === 0 ? 'none' : firstWin ? 'win' : 'loss',
      streakCount,
    })
  }
  return result
}
