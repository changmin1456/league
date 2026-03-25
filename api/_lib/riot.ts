export type RiotLeagueEntry = {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

export type RiotMatchParticipant = {
  puuid: string
  summonerName: string
  profileIcon?: number
  riotIdGameName?: string
  riotIdTagline?: string
  teamId: number
  teamPosition?: string
  championName: string
  champLevel?: number
  kills: number
  deaths: number
  assists: number
  win: boolean
  totalMinionsKilled: number
  neutralMinionsKilled: number
  totalDamageDealtToChampions?: number
  visionScore?: number
  wardsPlaced?: number
  detectorWardsPlaced?: number
  summoner1Id: number
  summoner2Id: number
  perks?: {
    styles?: Array<{
      style: number
      selections?: Array<{ perk: number }>
    }>
  }
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
}

export type RiotMatch = {
  info?: {
    queueId?: number
    gameCreation?: number
    gameDuration?: number
    participants?: RiotMatchParticipant[]
  }
}

export const normalizeRiotIdForStorage = (value: string) => value.replace(/\s+/g, '').trim().toLowerCase()

export const parseRiotId = (riotId: string) => {
  const [gameName, ...tagParts] = riotId.split('#')
  const tagLine = tagParts.join('#')
  if (!gameName || !tagLine) return null
  return {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
  }
}

export const fetchRiot = async <T>(url: string, apiKey: string, label: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': apiKey,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${label} -> Riot API ${response.status}: ${text}`)
  }
  return (await response.json()) as T
}

export const fetchRiotOptional = async <T>(url: string, apiKey: string, label: string): Promise<T | null> => {
  try {
    return await fetchRiot<T>(url, apiKey, label)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Riot API 403') || message.includes('Riot API 404')) {
      return null
    }
    throw error
  }
}
