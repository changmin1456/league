import type { ServerResponse } from 'node:http'
import { json, type ApiRequest } from '../_lib/http.js'
import { fetchRecentMatchStats, fetchAllMatchStats } from '../_lib/supabase.js'
import { buildLeaderboardRows } from '../_lib/stats.js'

export default async function handler(req: ApiRequest, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
      return
    }

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const sourceRows = await fetchRecentMatchStats(weekAgo)

    const byMatch = sourceRows.reduce<
      Record<
        string,
        Array<{
          riotId: string
          riotKey: string
          profileIconId: number | null
          win: number
          kills: number
          deaths: number
          assists: number
          visionScore: number
        }>
      >
    >((acc, row) => {
      const matchId = row.match_id
      if (!matchId) return acc
      const list = acc[matchId] ?? []
      list.push({
        riotId: row.riot_id,
        riotKey: row.riot_id_normalized,
        profileIconId:
          Number.isFinite(row.profile_icon_id) && Number(row.profile_icon_id) > 0 ? Number(row.profile_icon_id) : null,
        win: Number(row.win ?? 0),
        kills: Number(row.kills ?? 0),
        deaths: Number(row.deaths ?? 0),
        assists: Number(row.assists ?? 0),
        visionScore: Number(row.vision_score ?? 0),
      })
      acc[matchId] = list
      return acc
    }, {})

    const mvpCountByRiotKey = Object.values(byMatch).reduce<
      Record<string, { riotId: string; mvpCount: number; profileIconId: number | null }>
    >((acc, participants) => {
      const winners = participants.filter((participant) => participant.win === 1)
      if (winners.length === 0) return acc
      const teamKills = winners.reduce((sum, participant) => sum + participant.kills, 0)
      const best = winners.reduce<{ riotKey: string; riotId: string; profileIconId: number | null; score: number } | null>(
        (top, participant) => {
          const kp = teamKills > 0 ? ((participant.kills + participant.assists) / teamKills) * 100 : 0
          const kdaRatio =
            participant.deaths === 0
              ? participant.kills + participant.assists
              : (participant.kills + participant.assists) / participant.deaths
          const score = Number((kdaRatio + kp / 25 + participant.visionScore / 20).toFixed(4))
          if (!top || score > top.score) {
            return {
              riotKey: participant.riotKey,
              riotId: participant.riotId,
              profileIconId: participant.profileIconId,
              score,
            }
          }
          return top
        },
        null,
      )

      if (!best) return acc
      const prev = acc[best.riotKey] ?? { riotId: best.riotId, mvpCount: 0, profileIconId: best.profileIconId }
      acc[best.riotKey] = {
        riotId: best.riotId,
        mvpCount: prev.mvpCount + 1,
        profileIconId: prev.profileIconId ?? best.profileIconId,
      }
      return acc
    }, {})

    const mvpTopRows = Object.values(mvpCountByRiotKey)
      .sort((a, b) => {
        if (b.mvpCount !== a.mvpCount) return b.mvpCount - a.mvpCount
        return a.riotId.localeCompare(b.riotId)
      })
      .slice(0, 5)
      .map((row) => ({
        riotId: row.riotId,
        mvpCount: row.mvpCount,
        profileIconId: row.profileIconId,
      }))

    const leaderboardRows = buildLeaderboardRows(await fetchAllMatchStats())
    const kdaTopRows = leaderboardRows
      .sort((a, b) => {
        if (b.avgKda !== a.avgKda) return b.avgKda - a.avgKda
        return a.riotId.localeCompare(b.riotId)
      })
      .slice(0, 5)
      .map((row) => ({
        riotId: row.riotId,
        avgKda: row.avgKda,
        profileIconId: row.profileIconId,
      }))

    json(res, 200, {
      mvpTopRows,
      kdaTopRows,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '홈 통계 조회 실패'
    json(res, 500, { error: message })
  }
}
