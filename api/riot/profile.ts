import type { ServerResponse } from 'node:http'
import { json, parseUrl, type ApiRequest } from '../_lib/http'
import { fetchRiot, fetchRiotOptional, parseRiotId, type RiotLeagueEntry, type RiotMatch } from '../_lib/riot'

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
    const riotId = (url.searchParams.get('riotId') ?? '').trim()
    const parsed = parseRiotId(riotId)
    if (!parsed) {
      json(res, 400, { error: '아이디#태그 형식으로 입력해주세요.' })
      return
    }

    const account = await fetchRiot<{ puuid: string; gameName: string; tagLine: string }>(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`,
      apiKey,
      'account-v1',
    )

    const summoner = await fetchRiot<{ profileIconId: number }>(
      `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
      apiKey,
      'summoner-v4',
    )

    let leagues: RiotLeagueEntry[] = []
    let rankedStatus: 'ok' | 'forbidden' | 'not_found' = 'ok'
    try {
      leagues =
        (await fetchRiotOptional<RiotLeagueEntry[]>(
          `https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
          apiKey,
          'league-v4 by-puuid',
        )) ?? []
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('Riot API 403')) {
        rankedStatus = 'forbidden'
        leagues = []
      } else if (message.includes('Riot API 404')) {
        rankedStatus = 'not_found'
        leagues = []
      } else {
        throw error
      }
    }

    const matchIds =
      (await fetchRiotOptional<string[]>(
        `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=5`,
        apiKey,
        'match-v5 ids',
      )) ?? []

    const matches = await Promise.all(
      matchIds.map((matchId) =>
        fetchRiot<RiotMatch>(
          `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          apiKey,
          `match-v5 ${matchId}`,
        ),
      ),
    )

    let wins = 0
    let kills = 0
    let deaths = 0
    let assists = 0
    const championMap = new Map<string, { games: number; kills: number; deaths: number; assists: number }>()
    const lineDistribution = new Map<string, number>()

    const recentMatches: Array<{
      result: 'WIN' | 'LOSE'
      championName: string
      kills: number
      deaths: number
      assists: number
      cs: number
      queueId: number | null
      durationSec: number
      createdAt: number
      items: number[]
      spells: number[]
      primaryRune: number | null
      primaryStyle: number | null
      subStyle: number | null
      teamPosition: string | null
      teammates: Array<{ summonerName: string; championName: string }>
      opponents: Array<{ summonerName: string; championName: string }>
    }> = []

    for (const match of matches) {
      const participant = match.info?.participants?.find((p) => p.puuid === account.puuid)
      if (!participant) continue
      const participants = match.info?.participants ?? []
      if (participant.win) wins += 1
      kills += participant.kills
      deaths += participant.deaths
      assists += participant.assists

      const prev = championMap.get(participant.championName) ?? {
        games: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
      }
      championMap.set(participant.championName, {
        games: prev.games + 1,
        kills: prev.kills + participant.kills,
        deaths: prev.deaths + participant.deaths,
        assists: prev.assists + participant.assists,
      })

      recentMatches.push({
        result: participant.win ? 'WIN' : 'LOSE',
        championName: participant.championName,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        queueId: match.info?.queueId ?? null,
        durationSec: match.info?.gameDuration ?? 0,
        createdAt: match.info?.gameCreation ?? 0,
        items: [
          participant.item0,
          participant.item1,
          participant.item2,
          participant.item3,
          participant.item4,
          participant.item5,
          participant.item6,
        ],
        spells: [participant.summoner1Id, participant.summoner2Id],
        primaryRune: participant.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
        primaryStyle: participant.perks?.styles?.[0]?.style ?? null,
        subStyle: participant.perks?.styles?.[1]?.style ?? null,
        teamPosition: participant.teamPosition ?? null,
        teammates: participants
          .filter((p) => p.teamId === participant.teamId && p.puuid !== participant.puuid)
          .map((p) => ({
            summonerName: p.summonerName,
            championName: p.championName,
          })),
        opponents: participants
          .filter((p) => p.teamId !== participant.teamId)
          .map((p) => ({
            summonerName: p.summonerName,
            championName: p.championName,
          })),
      })

      const lane = participant.teamPosition && participant.teamPosition !== '' ? participant.teamPosition : 'UNKNOWN'
      lineDistribution.set(lane, (lineDistribution.get(lane) ?? 0) + 1)
    }

    const solo = leagues.find((entry) => entry.queueType === 'RANKED_SOLO_5x5') ?? null
    const flex = leagues.find((entry) => entry.queueType === 'RANKED_FLEX_SR') ?? null
    const totalGames = matches.length
    const recentLosses = totalGames - wins
    const kda = deaths === 0 ? kills + assists : Number(((kills + assists) / deaths).toFixed(2))

    const championKdaTop = [...championMap.entries()]
      .map(([championName, stats]) => {
        const champKda =
          stats.deaths === 0
            ? stats.kills + stats.assists
            : Number(((stats.kills + stats.assists) / stats.deaths).toFixed(2))
        return {
          championName,
          games: stats.games,
          kda: champKda,
        }
      })
      .sort((a, b) => b.games - a.games)
      .slice(0, 3)

    json(res, 200, {
      summoner: {
        riotId: `${account.gameName}#${account.tagLine}`,
        profileIconId: summoner.profileIconId,
      },
      rankedSolo: solo,
      rankedFlex: flex,
      rankedStatus,
      recent: {
        wins,
        losses: recentLosses,
        kda,
        totalGames,
      },
      championKdaTop,
      recentMatches,
      lineDistribution: {
        TOP: lineDistribution.get('TOP') ?? 0,
        JUNGLE: lineDistribution.get('JUNGLE') ?? 0,
        MIDDLE: lineDistribution.get('MIDDLE') ?? 0,
        BOTTOM: lineDistribution.get('BOTTOM') ?? 0,
        UTILITY: lineDistribution.get('UTILITY') ?? 0,
        UNKNOWN: lineDistribution.get('UNKNOWN') ?? 0,
      },
      seasonTierHistory: [],
      custom: {
        score: null,
        wins: null,
        losses: null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Riot API 요청 실패'
    json(res, 500, { error: message })
  }
}
