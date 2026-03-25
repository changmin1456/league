import type { ServerResponse } from 'node:http'
import { json, type ApiRequest } from '../_lib/http.js'
import { fetchRiot, parseRiotId } from '../_lib/riot.js'
import { fetchAllMatchStats, updateProfileIconByRiotKey } from '../_lib/supabase.js'
import { buildLeaderboardRows } from '../_lib/stats.js'

export default async function handler(req: ApiRequest, res: ServerResponse) {
  try {
    if (req.method !== 'GET') {
      json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
      return
    }

    const apiKey = process.env.RIOT_API_KEY
    const baseRows = buildLeaderboardRows(await fetchAllMatchStats())

    const rows = await Promise.all(
      baseRows.map(async (row) => {
        if (typeof row.profileIconId === 'number' && row.profileIconId > 0) return row
        if (!apiKey) return row

        const parsed = parseRiotId(row.riotId)
        if (!parsed) return row

        try {
          const account = await fetchRiot<{ puuid: string }>(
            `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`,
            apiKey,
            `account-v1 ${row.riotId}`,
          )
          const summoner = await fetchRiot<{ profileIconId?: number }>(
            `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
            apiKey,
            `summoner-v4 ${row.riotId}`,
          )
          const profileIconId =
            typeof summoner.profileIconId === 'number' && Number.isFinite(summoner.profileIconId)
              ? summoner.profileIconId
              : null
          if (profileIconId) {
            await updateProfileIconByRiotKey(row.riotKey, profileIconId)
          }
          return { ...row, profileIconId }
        } catch {
          return row
        }
      }),
    )

    json(res, 200, { rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : '리더보드 조회 실패'
    json(res, 500, { error: message })
  }
}
