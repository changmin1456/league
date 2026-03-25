import type { ServerResponse } from 'node:http'
import { json, readJsonBody, type ApiRequest } from '../_lib/http.js'

let resolvedTournamentId = (process.env.RIOT_TOURNAMENT_ID ?? '').trim()
let resolvedProviderId = (process.env.RIOT_TOURNAMENT_PROVIDER_ID ?? '').trim()

export default async function handler(req: ApiRequest, res: ServerResponse) {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST 메서드만 허용됩니다.' })
      return
    }

    const tournamentApiKey = process.env.RIOT_TOURNAMENT_API_KEY || process.env.RIOT_API_KEY
    const tournamentRegion = process.env.RIOT_TOURNAMENT_REGION || 'KR'
    const tournamentCallbackUrl = process.env.RIOT_TOURNAMENT_CALLBACK_URL || 'https://example.com/callback'
    const useTournamentStub = process.env.RIOT_TOURNAMENT_USE_STUB !== 'false'
    const useLocalTournamentStub = process.env.RIOT_TOURNAMENT_USE_LOCAL_STUB !== 'false'

    if (useLocalTournamentStub) {
      const code = `STUB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      json(res, 200, { code })
      return
    }

    if (!tournamentApiKey) {
      json(res, 500, { error: 'RIOT_TOURNAMENT_API_KEY가 설정되지 않았습니다.' })
      return
    }

    if (!resolvedTournamentId) {
      const providerEndpoint = useTournamentStub
        ? 'https://asia.api.riotgames.com/lol/tournament-stub/v5/providers'
        : 'https://asia.api.riotgames.com/lol/tournament/v5/providers'
      const tournamentEndpoint = useTournamentStub
        ? 'https://asia.api.riotgames.com/lol/tournament-stub/v5/tournaments'
        : 'https://asia.api.riotgames.com/lol/tournament/v5/tournaments'

      if (!resolvedProviderId) {
        const providerUrl = `${providerEndpoint}?api_key=${encodeURIComponent(tournamentApiKey)}`
        const providerResponse = await fetch(providerUrl, {
          method: 'POST',
          headers: {
            'X-Riot-Token': tournamentApiKey,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            region: tournamentRegion,
            url: tournamentCallbackUrl,
          }),
        })
        if (!providerResponse.ok) {
          const text = await providerResponse.text()
          json(res, providerResponse.status, { error: `토너먼트 Provider 생성 실패: ${text}` })
          return
        }
        resolvedProviderId = String(await providerResponse.json())
      }

      const tournamentUrl = `${tournamentEndpoint}?api_key=${encodeURIComponent(tournamentApiKey)}`
      const tournamentResponse = await fetch(tournamentUrl, {
        method: 'POST',
        headers: {
          'X-Riot-Token': tournamentApiKey,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          name: `league-inhouse-${Date.now()}`,
          providerId: Number(resolvedProviderId),
        }),
      })
      if (!tournamentResponse.ok) {
        const text = await tournamentResponse.text()
        json(res, tournamentResponse.status, { error: `토너먼트 생성 실패: ${text}` })
        return
      }
      resolvedTournamentId = String(await tournamentResponse.json())
    }

    const body = (await readJsonBody(req)) as Record<string, unknown>
    const stage = typeof body.stage === 'string' ? body.stage : 'unknown'
    const matchId = typeof body.matchId === 'string' ? body.matchId : 'unknown'
    const groupId = typeof body.groupId === 'string' ? body.groupId : 'unknown'
    const title = typeof body.title === 'string' ? body.title : '내전'
    const startAt = typeof body.startAt === 'string' ? body.startAt : ''
    const teamAName = typeof body.teamAName === 'string' ? body.teamAName : 'teamA'
    const teamBName = typeof body.teamBName === 'string' ? body.teamBName : 'teamB'

    const metadata = [title, startAt, groupId, matchId, stage, `${teamAName} vs ${teamBName}`]
      .filter((value) => value.trim() !== '')
      .join(' | ')
      .slice(0, 480)

    const endpoint = useTournamentStub
      ? 'https://asia.api.riotgames.com/lol/tournament-stub/v5/codes'
      : 'https://asia.api.riotgames.com/lol/tournament/v5/codes'

    const response = await fetch(
      `${endpoint}?count=1&tournamentId=${encodeURIComponent(resolvedTournamentId)}&api_key=${encodeURIComponent(tournamentApiKey)}`,
      {
        method: 'POST',
        headers: {
          'X-Riot-Token': tournamentApiKey,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          mapType: 'SUMMONERS_RIFT',
          pickType: 'TOURNAMENT_DRAFT',
          teamSize: 5,
          spectatorType: 'ALL',
          metadata,
        }),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      json(res, response.status, { error: `토너먼트 코드 발급 실패: ${text}` })
      return
    }

    const codes = (await response.json()) as string[]
    const code = Array.isArray(codes) ? codes[0] : null
    if (!code) {
      json(res, 500, { error: '토너먼트 코드 응답이 비어 있습니다.' })
      return
    }

    json(res, 200, { code })
  } catch (error) {
    const message = error instanceof Error ? error.message : '토너먼트 코드 요청 실패'
    json(res, 500, { error: message })
  }
}
