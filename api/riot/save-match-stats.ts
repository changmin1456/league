import type { ServerResponse } from 'node:http'
import { json, readJsonBody, type ApiRequest } from '../_lib/http'
import { fetchRiot, normalizeRiotIdForStorage, type RiotMatch } from '../_lib/riot'
import { upsertMatchStats } from '../_lib/supabase'

export default async function handler(req: ApiRequest, res: ServerResponse) {
  try {
    const apiKey = process.env.RIOT_API_KEY
    if (!apiKey) {
      json(res, 500, { error: 'RIOT_API_KEY가 설정되지 않았습니다.' })
      return
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST 메서드만 허용됩니다.' })
      return
    }

    const body = (await readJsonBody(req)) as Record<string, unknown>
    const matchId = typeof body.matchId === 'string' ? body.matchId.replace(/\s+/g, '').trim() : ''
    const targetRiotId = typeof body.riotId === 'string' ? body.riotId.trim() : ''
    const targetRiotIdNormalized = targetRiotId ? normalizeRiotIdForStorage(targetRiotId) : ''

    if (!matchId) {
      json(res, 400, { error: 'matchId를 입력해주세요.' })
      return
    }

    const match = await fetchRiot<RiotMatch>(
      `https://asia.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
      apiKey,
      `match-v5 ${matchId}`,
    )

    const participants = match.info?.participants ?? []
    const filteredParticipants =
      targetRiotIdNormalized === ''
        ? participants
        : participants.filter((participant) => {
            const riotId =
              participant.riotIdGameName && participant.riotIdTagline
                ? `${participant.riotIdGameName}#${participant.riotIdTagline}`
                : participant.summonerName
            return normalizeRiotIdForStorage(riotId) === targetRiotIdNormalized
          })

    if (filteredParticipants.length === 0) {
      json(res, 404, { error: '해당 매치에서 대상 유저를 찾지 못했습니다.' })
      return
    }

    const gameCreation = Number(match.info?.gameCreation ?? 0)
    const gameDuration = Number(match.info?.gameDuration ?? 0)

    await upsertMatchStats(
      filteredParticipants.map((participant) => {
        const riotId =
          participant.riotIdGameName && participant.riotIdTagline
            ? `${participant.riotIdGameName}#${participant.riotIdTagline}`
            : participant.summonerName
        return {
          match_id: matchId,
          riot_id: riotId,
          riot_id_normalized: normalizeRiotIdForStorage(riotId),
          summoner_name: participant.summonerName,
          profile_icon_id: Number.isFinite(participant.profileIcon) ? Number(participant.profileIcon) : null,
          champion_name: participant.championName,
          win: participant.win ? 1 : 0,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          damage: participant.totalDamageDealtToChampions ?? 0,
          vision_score: participant.visionScore ?? 0,
          game_creation: gameCreation,
          game_duration: gameDuration,
        }
      }),
    )

    json(res, 200, {
      matchId,
      savedCount: filteredParticipants.length,
      gameCreation,
      gameDuration,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '매치 통계 저장 실패'
    json(res, 500, { error: message })
  }
}
