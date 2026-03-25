import type { ServerResponse } from 'node:http'
import { json, parseUrl, type ApiRequest } from '../_lib/http.js'
import { fetchRiot, type RiotMatch } from '../_lib/riot.js'

export default async function handler(req: ApiRequest, res: ServerResponse) {
  try {
    const apiKey = process.env.RIOT_API_KEY
    if (!apiKey) {
      json(res, 500, { error: 'RIOT_API_KEY가 설정되지 않았습니다.' })
      return
    }
    if (req.method !== 'GET') {
      json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
      return
    }

    const url = parseUrl(req)
    const matchId = (url.searchParams.get('matchId') ?? '').replace(/\s+/g, '').trim()
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
    const byTeam = participants.reduce<Record<string, typeof participants>>((acc, participant) => {
      const key = String(participant.teamId ?? 0)
      const list = acc[key] ?? []
      list.push(participant)
      acc[key] = list
      return acc
    }, {})

    const teams = Object.entries(byTeam)
      .map(([teamId, memberList]) => ({
        teamId: Number(teamId),
        win: memberList.some((member) => member.win),
        participants: memberList.map((member) => ({
          puuid: member.puuid,
          summonerName: member.summonerName,
          riotId:
            member.riotIdGameName && member.riotIdTagline
              ? `${member.riotIdGameName}#${member.riotIdTagline}`
              : member.summonerName,
          championName: member.championName,
          championLevel: member.champLevel ?? 0,
          kills: member.kills,
          deaths: member.deaths,
          assists: member.assists,
          win: member.win,
          totalMinionsKilled: member.totalMinionsKilled ?? 0,
          neutralMinionsKilled: member.neutralMinionsKilled ?? 0,
          totalDamageDealtToChampions: member.totalDamageDealtToChampions ?? 0,
          visionScore: member.visionScore ?? 0,
          wardsPlaced: member.wardsPlaced ?? 0,
          detectorWardsPlaced: member.detectorWardsPlaced ?? 0,
          summonerSpellIds: [member.summoner1Id, member.summoner2Id],
          primaryRuneId: member.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
          items: [member.item0, member.item1, member.item2, member.item3, member.item4, member.item5, member.item6],
        })),
      }))
      .sort((a, b) => a.teamId - b.teamId)

    json(res, 200, {
      matchId,
      gameCreation: match.info?.gameCreation ?? 0,
      gameDuration: match.info?.gameDuration ?? 0,
      queueId: match.info?.queueId ?? null,
      teams,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '매치 상세 조회 실패'
    json(res, 500, { error: message })
  }
}
