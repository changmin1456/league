import type { ServerResponse } from 'node:http'
import { json, parseUrl, type ApiRequest } from '../_lib/http.js'
import { normalizeRiotIdForStorage } from '../_lib/riot.js'
import { fetchMatchStatsByRiotId } from '../_lib/supabase.js'
import { computeMatchKda } from '../_lib/stats.js'

export default async function handler(req: ApiRequest, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
      return
    }

    const url = parseUrl(req)
    const riotId = (url.searchParams.get('riotId') ?? '').trim()
    if (!riotId) {
      json(res, 400, { error: 'riotId를 입력해주세요.' })
      return
    }

    const normalizedRiotId = normalizeRiotIdForStorage(riotId)
    const rows = await fetchMatchStatsByRiotId(normalizedRiotId)

    const totalGames = rows.length
    const wins = rows.reduce((sum, row) => sum + (row.win === 1 ? 1 : 0), 0)
    const losses = Math.max(0, totalGames - wins)
    const totalKills = rows.reduce((sum, row) => sum + row.kills, 0)
    const totalDeaths = rows.reduce((sum, row) => sum + row.deaths, 0)
    const totalAssists = rows.reduce((sum, row) => sum + row.assists, 0)
    const totalDamage = rows.reduce((sum, row) => sum + row.damage, 0)
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

    const totalKdaRaw =
      totalGames > 0
        ? rows.reduce((sum, row) => sum + computeMatchKda(row.kills, row.deaths, row.assists), 0) / totalGames
        : null

    const byChampion = new Map<
      string,
      { games: number; wins: number; kills: number; deaths: number; assists: number }
    >()

    for (const row of rows) {
      const key = row.champion_name
      const prev = byChampion.get(key) ?? { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }
      byChampion.set(key, {
        games: prev.games + 1,
        wins: prev.wins + (row.win === 1 ? 1 : 0),
        kills: prev.kills + row.kills,
        deaths: prev.deaths + row.deaths,
        assists: prev.assists + row.assists,
      })
    }

    const champions = [...byChampion.entries()]
      .map(([championName, value]) => {
        const lossesByChampion = value.games - value.wins
        const winRateByChampion = value.games > 0 ? (value.wins / value.games) * 100 : 0
        const kdaByChampion =
          value.deaths === 0 ? value.kills + value.assists : (value.kills + value.assists) / value.deaths

        return {
          championName,
          games: value.games,
          wins: value.wins,
          losses: lossesByChampion,
          winRate: Number(winRateByChampion.toFixed(2)),
          kda: Number(kdaByChampion.toFixed(2)),
          kills: Number((value.kills / value.games).toFixed(2)),
          deaths: Number((value.deaths / value.games).toFixed(2)),
          assists: Number((value.assists / value.games).toFixed(2)),
        }
      })
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games
        return a.championName.localeCompare(b.championName)
      })
      .slice(0, 20)

    json(res, 200, {
      riotId,
      totalGames,
      wins,
      losses,
      winRate,
      totalKills,
      totalDeaths,
      totalAssists,
      totalDamage,
      totalKda: totalKdaRaw === null ? null : Number(totalKdaRaw.toFixed(2)),
      champions,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '통계 조회 실패'
    json(res, 500, { error: message })
  }
}
