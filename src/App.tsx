import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'

type RankedEntry = {
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

type RiotProfileResponse = {
  summoner: {
    riotId: string
    profileIconId: number
  }
  rankedSolo: RankedEntry | null
  seasonTierHistory?: Array<{
    season?: number | string
    tier?: string
    rank?: string
    highestTier?: string
  }>
  custom?: {
    score: number | null
    wins: number | null
    losses: number | null
    kills?: number | null
    deaths?: number | null
    assists?: number | null
  }
}

type PersistedPlayerStats = {
  riotId: string
  totalGames: number
  wins: number
  losses: number
  winRate: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  totalDamage: number
  totalKda: number | null
  champions: Array<{
    championName: string
    games: number
    wins: number
    losses: number
    winRate: number
    kda: number
    kills: number
    deaths: number
    assists: number
  }>
}

type RecordLeaderboardRow = {
  riotKey: string
  riotId: string
  profileIconId: number | null
  games: number
  wins: number
  losses: number
  winRate: number
  avgKda: number
  peakDamage: number
  streakType?: 'win' | 'loss' | 'none'
  streakCount?: number
}

type HomeMvpTopRow = {
  riotId: string
  mvpCount: number
  profileIconId: number | null
}

type HomeKdaTopRow = {
  riotId: string
  avgKda: number
  profileIconId: number | null
}

type NoticeItem = {
  id: string
  title: string
  content: string
  createdAt: number
  authorLabel: string
}

type RiotMatchDetailParticipant = {
  puuid: string
  summonerName: string
  riotId: string
  championName: string
  championLevel: number
  kills: number
  deaths: number
  assists: number
  win: boolean
  totalMinionsKilled: number
  neutralMinionsKilled: number
  totalDamageDealtToChampions: number
  visionScore: number
  wardsPlaced: number
  detectorWardsPlaced: number
  summonerSpellIds: number[]
  primaryRuneId: number | null
  items: number[]
}

type RiotMatchDetailResponse = {
  matchId: string
  gameCreation: number
  gameDuration: number
  queueId: number | null
  teams: Array<{
    teamId: number
    win: boolean
    participants: RiotMatchDetailParticipant[]
  }>
}

type SignupProfile = {
  accountLabel: string
  discordId: string
  riotId: string
  password: string
  seasonPeakTier: string
  mainLine: string
  userType: '운영진' | '일반'
  approvalStatus: 'pending' | 'approved'
}

const SIGNUP_STORAGE_KEY = 'league-signup-users'
const ADMIN_PROFILE_STORAGE_KEY = 'league-admin-profile'
const AUTH_SESSION_STORAGE_KEY = 'league-auth-session'
const LAST_ACTIVE_MENU_STORAGE_KEY = 'league-last-active-menu'
const INHOUSE_CARDS_STORAGE_KEY = 'league-inhouse-cards'
const INHOUSE_APPLICATIONS_STORAGE_KEY = 'league-inhouse-applications'
const INHOUSE_MATCH_RECORDS_STORAGE_KEY = 'league-inhouse-match-records'
const TEAM_BRACKETS_STORAGE_KEY = 'league-team-brackets'
const INHOUSE_BRACKET_RECORDS_STORAGE_KEY = 'league-inhouse-bracket-records'
const MATCH_DETAIL_ID_MAP_STORAGE_KEY = 'league-match-detail-id-map'
const NOTICE_ITEMS_STORAGE_KEY = 'league-notice-items'
const PERSIST_STATE_KEYS = [
  SIGNUP_STORAGE_KEY,
  ADMIN_PROFILE_STORAGE_KEY,
  INHOUSE_CARDS_STORAGE_KEY,
  INHOUSE_APPLICATIONS_STORAGE_KEY,
  INHOUSE_MATCH_RECORDS_STORAGE_KEY,
  TEAM_BRACKETS_STORAGE_KEY,
  INHOUSE_BRACKET_RECORDS_STORAGE_KEY,
  MATCH_DETAIL_ID_MAP_STORAGE_KEY,
  NOTICE_ITEMS_STORAGE_KEY,
] as const
const DDRAGON_VERSION = '14.24.1'
const ADMIN_ACCOUNT = {
  id: 'admin',
  password: '862588',
}

type AdminProfile = {
  accountLabel: string
  discordId: string
  riotId: string
  seasonPeakTier: string
  mainLine: string
}

type AuthSession = {
  userLabel: string
  isAdmin: boolean
}

type InhouseStat = {
  wins: number
  losses: number
  winRate: number
  winStreak: number
}

type TierOption = {
  value: string
  label: string
  requiresLp: boolean
  parsePattern: RegExp
}

type TierColorClass =
  | 'tier-iron'
  | 'tier-bronze'
  | 'tier-silver'
  | 'tier-gold'
  | 'tier-platinum'
  | 'tier-emerald'
  | 'tier-diamond'
  | 'tier-master'
  | 'tier-grandmaster'
  | 'tier-challenger'
  | 'tier-unranked'

const SEASON_OPTIONS = Array.from({ length: 15 }, (_, index) => `S${index + 2}`)
const TIER_OPTIONS: TierOption[] = [
  { value: 'IRON_4', label: '아이언 4', requiresLp: false, parsePattern: /(아이언\s*4|IRON\s*4)/i },
  { value: 'IRON_3', label: '아이언 3', requiresLp: false, parsePattern: /(아이언\s*3|IRON\s*3)/i },
  { value: 'IRON_2', label: '아이언 2', requiresLp: false, parsePattern: /(아이언\s*2|IRON\s*2)/i },
  { value: 'IRON_1', label: '아이언 1', requiresLp: false, parsePattern: /(아이언\s*1|IRON\s*1)/i },
  { value: 'BRONZE_4', label: '브론즈 4', requiresLp: false, parsePattern: /(브론즈\s*4|BRONZE\s*4)/i },
  { value: 'BRONZE_3', label: '브론즈 3', requiresLp: false, parsePattern: /(브론즈\s*3|BRONZE\s*3)/i },
  { value: 'BRONZE_2', label: '브론즈 2', requiresLp: false, parsePattern: /(브론즈\s*2|BRONZE\s*2)/i },
  { value: 'BRONZE_1', label: '브론즈 1', requiresLp: false, parsePattern: /(브론즈\s*1|BRONZE\s*1)/i },
  { value: 'SILVER_4', label: '실버 4', requiresLp: false, parsePattern: /(실버\s*4|SILVER\s*4)/i },
  { value: 'SILVER_3', label: '실버 3', requiresLp: false, parsePattern: /(실버\s*3|SILVER\s*3)/i },
  { value: 'SILVER_2', label: '실버 2', requiresLp: false, parsePattern: /(실버\s*2|SILVER\s*2)/i },
  { value: 'SILVER_1', label: '실버 1', requiresLp: false, parsePattern: /(실버\s*1|SILVER\s*1)/i },
  { value: 'GOLD_4', label: '골드 4', requiresLp: false, parsePattern: /(골드\s*4|GOLD\s*4)/i },
  { value: 'GOLD_3', label: '골드 3', requiresLp: false, parsePattern: /(골드\s*3|GOLD\s*3)/i },
  { value: 'GOLD_2', label: '골드 2', requiresLp: false, parsePattern: /(골드\s*2|GOLD\s*2)/i },
  { value: 'GOLD_1', label: '골드 1', requiresLp: false, parsePattern: /(골드\s*1|GOLD\s*1)/i },
  { value: 'PLATINUM_4', label: '플래티넘 4', requiresLp: false, parsePattern: /(플래티넘\s*4|PLATINUM\s*4)/i },
  { value: 'PLATINUM_3', label: '플래티넘 3', requiresLp: false, parsePattern: /(플래티넘\s*3|PLATINUM\s*3)/i },
  { value: 'PLATINUM_2', label: '플래티넘 2', requiresLp: false, parsePattern: /(플래티넘\s*2|PLATINUM\s*2)/i },
  { value: 'PLATINUM_1', label: '플래티넘 1', requiresLp: false, parsePattern: /(플래티넘\s*1|PLATINUM\s*1)/i },
  { value: 'EMERALD_4', label: '에메랄드 4', requiresLp: false, parsePattern: /(에메랄드\s*4|EMERALD\s*4)/i },
  { value: 'EMERALD_3', label: '에메랄드 3', requiresLp: false, parsePattern: /(에메랄드\s*3|EMERALD\s*3)/i },
  { value: 'EMERALD_2', label: '에메랄드 2', requiresLp: false, parsePattern: /(에메랄드\s*2|EMERALD\s*2)/i },
  { value: 'EMERALD_1', label: '에메랄드 1', requiresLp: false, parsePattern: /(에메랄드\s*1|EMERALD\s*1)/i },
  { value: 'DIAMOND_4', label: '다이아 4', requiresLp: false, parsePattern: /(다이아\s*4|DIAMOND\s*4)/i },
  { value: 'DIAMOND_3', label: '다이아 3', requiresLp: false, parsePattern: /(다이아\s*3|DIAMOND\s*3)/i },
  { value: 'DIAMOND_2', label: '다이아 2', requiresLp: false, parsePattern: /(다이아\s*2|DIAMOND\s*2)/i },
  { value: 'DIAMOND_1', label: '다이아 1', requiresLp: false, parsePattern: /(다이아\s*1|DIAMOND\s*1)/i },
  { value: 'MASTER', label: '마스터', requiresLp: true, parsePattern: /(마스터|MASTER)/i },
  { value: 'GRANDMASTER', label: '그랜드마스터', requiresLp: true, parsePattern: /(그랜드마스터|GRANDMASTER)/i },
  { value: 'CHALLENGER', label: '챌린저', requiresLp: true, parsePattern: /(챌린저|CHALLENGER)/i },
]

const findTierOption = (tierValue: string) => TIER_OPTIONS.find((option) => option.value === tierValue)

const TIER_NAME_KR: Record<string, string> = {
  IRON: '아이언',
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  EMERALD: '에메랄드',
  DIAMOND: '다이아',
  MASTER: '마스터',
  GRANDMASTER: '그랜드마스터',
  CHALLENGER: '챌린저',
}

const rankToNumber = (rank: string) => {
  const source = rank.trim().toUpperCase()
  if (source === 'IV') return '4'
  if (source === 'III') return '3'
  if (source === 'II') return '2'
  if (source === 'I') return '1'
  return source
}

const getTierColorClass = (value: string): TierColorClass => {
  const source = value.toUpperCase()
  if (source.includes('아이언') || source.includes('IRON')) return 'tier-iron'
  if (source.includes('브론즈') || source.includes('BRONZE')) return 'tier-bronze'
  if (source.includes('실버') || source.includes('SILVER')) return 'tier-silver'
  if (source.includes('골드') || source.includes('GOLD')) return 'tier-gold'
  if (source.includes('플래티넘') || source.includes('PLATINUM')) return 'tier-platinum'
  if (source.includes('에메랄드') || source.includes('EMERALD')) return 'tier-emerald'
  if (source.includes('다이아') || source.includes('DIAMOND')) return 'tier-diamond'
  if (source.includes('그랜드마스터') || source.includes('GRANDMASTER')) return 'tier-grandmaster'
  if (source.includes('챌린저') || source.includes('CHALLENGER')) return 'tier-challenger'
  if (source.includes('마스터') || source.includes('MASTER')) return 'tier-master'
  return 'tier-unranked'
}

const parseSeasonPeakTier = (seasonPeakTier: string) => {
  const source = seasonPeakTier.trim()
  if (!source) return { season: '', tier: '', lp: '' }
  const seasonMatch = source.match(/\bS(1[0-6]|[2-9])\b/i)
  const tierOption = TIER_OPTIONS.find((option) => option.parsePattern.test(source))
  const lpMatch = source.match(/(\d+)\s*LP/i)

  return {
    season: seasonMatch ? `S${seasonMatch[1]}` : '',
    tier: tierOption?.value ?? '',
    lp: lpMatch?.[1] ?? '',
  }
}

const buildSeasonPeakTier = (season: string, tierValue: string, lp: string) => {
  const tierOption = findTierOption(tierValue)
  if (!season || !tierOption) return ''
  if (tierOption.requiresLp) {
    const trimmedLp = lp.trim()
    return trimmedLp ? `${season} ${tierOption.label} ${trimmedLp}LP` : `${season} ${tierOption.label}`
  }
  return `${season} ${tierOption.label}`
}

const normalizeRiotIdValue = (value: string) => {
  const [rawName, ...rawTagParts] = value.trim().split('#')
  const rawTag = rawTagParts.join('#')
  if (!rawName || !rawTag) return null
  const gameName = rawName.replace(/\s+/g, '')
  const tagLine = rawTag.replace(/\s+/g, '')
  if (!gameName || !tagLine) return null
  return `${gameName}#${tagLine}`.toLowerCase()
}

const INHOUSE_CATEGORY_OPTIONS = [
  {
    value: 'inhouse-apply',
    label: '내전 신청',
    title: '내전 신청',
    description: '내전 참여 신청 폼을 여기에 배치할 예정입니다.',
  },
  {
    value: 'bet-apply',
    label: '내기 신청',
    title: '내기 신청',
    description: '내기전 참여 신청 폼을 여기에 배치할 예정입니다.',
  },
] as const

type InhouseCategoryValue = (typeof INHOUSE_CATEGORY_OPTIONS)[number]['value']

type InhouseCard = {
  id: string
  category: InhouseCategoryValue
  title: string
  startAt: string
}

type InhouseApplyStatus = 'applied' | 'waiting'

type InhouseApplication = {
  id: string
  cardId: string
  userLabel: string
  status: InhouseApplyStatus
  riotId: string
  discordId: string
}

type InhouseMatchRecord = {
  id: string
  riotId: string
  result: 'win' | 'loss'
  createdAt: number
}

type TeamBracketMember = {
  id: string
  riotId: string
  discordId: string
  seedNumber: number
  sp: number
  highestTier: string
  currentTier: string
  profileIconId: number | null
}

type TeamBracketTeam = {
  teamNumber: number
  teamSp: number
  color: string
  members: TeamBracketMember[]
}

type TeamBracketMatch = {
  id: string
  stage: 'semi' | 'final' | 'lower'
  teamA: TeamBracketTeam | null
  teamB: TeamBracketTeam | null
  winner: 'A' | 'B' | null
  tournamentCode: string | null
}

type TeamBracketGroup = {
  id: string
  label: string
  matches: TeamBracketMatch[]
}

type TeamBracket = {
  cardId: string
  createdAt: number
  groups: TeamBracketGroup[]
}

type BracketPlacementRecord = {
  firstTeamNumber: number | null
  secondTeamNumber: number | null
  thirdTeamNumber: number | null
  fourthTeamNumber: number | null
}

type InhouseBracketMatchRecord = {
  matchId: string
  stage: TeamBracketMatch['stage']
  teamANumber: number | null
  teamBNumber: number | null
  winnerTeamNumber: number | null
  tournamentCode: string | null
}

type InhouseBracketTeamRecord = {
  teamNumber: number
  members: Array<{
    riotId: string
    highestTier: string
  }>
}

type InhouseBracketRecord = {
  id: string
  cardId: string
  category: InhouseCategoryValue
  title: string
  startAt: string
  savedAt: number
  groups: Array<{
    groupId: string
    label: string
    placement: BracketPlacementRecord
    teams: InhouseBracketTeamRecord[]
    matches: InhouseBracketMatchRecord[]
  }>
}

const DEFAULT_MAX_SEED_MEMBER_COUNT = 60
const MAX_SEED_MEMBER_COUNT_BY_START_AT: Record<string, number> = {
  '2026.03.01 10:30': 60,
}
const SEED_ROW_ACCENTS = ['#ff5a67', '#4a90ff', '#38c976', '#ff9f43', '#b07cff']
const TEAM_SUMMARY_COLORS = ['#3e94ee', '#ff433e', '#66bb6a', '#ffad2f', '#b786c7', '#35a8db']

const getMaxSeedMemberCountByStartAt = (startAt: string) => {
  return MAX_SEED_MEMBER_COUNT_BY_START_AT[startAt.trim()] ?? DEFAULT_MAX_SEED_MEMBER_COUNT
}

const parseInhouseStartAtTimestamp = (startAt: string) => {
  const normalized = startAt.trim()
  if (!normalized) return Number.POSITIVE_INFINITY

  const direct = Date.parse(normalized)
  if (!Number.isNaN(direct)) return direct

  const match = normalized.match(
    /^(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})(?:[.\-/\s]+(?:(오전|오후|AM|PM)\s*)?(\d{1,2})(?::(\d{1,2}))?)?$/i,
  )
  if (!match) return Number.POSITIVE_INFINITY

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const meridiem = (match[4] ?? '').toUpperCase()
  const rawHour = Number(match[5] ?? '0')
  const minute = Number(match[6] ?? '0')
  let hour = rawHour
  if (meridiem === '오전' || meridiem === 'AM') {
    if (hour === 12) hour = 0
  } else if (meridiem === '오후' || meridiem === 'PM') {
    if (hour < 12) hour += 12
  }
  return new Date(year, month, day, hour, minute).getTime()
}

const shuffleArray = <T,>(source: T[]) => {
  const next = [...source]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const temp = next[index]
    next[index] = next[randomIndex]
    next[randomIndex] = temp
  }
  return next
}

const readInhouseCards = (): InhouseCard[] => {
  try {
    const raw = localStorage.getItem(INHOUSE_CARDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (
        typeof record.id !== 'string' ||
        typeof record.category !== 'string' ||
        typeof record.title !== 'string' ||
        typeof record.startAt !== 'string'
      ) {
        return []
      }
      const category = record.category as InhouseCategoryValue
      if (!INHOUSE_CATEGORY_OPTIONS.some((option) => option.value === category)) {
        return []
      }
      return [
        {
          id: record.id,
          category,
          title: record.title,
          startAt: record.startAt,
        } satisfies InhouseCard,
      ]
    })
  } catch {
    return []
  }
}

const readInhouseApplications = (): InhouseApplication[] => {
  try {
    const raw = localStorage.getItem(INHOUSE_APPLICATIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (typeof record.id !== 'string' || typeof record.cardId !== 'string' || typeof record.userLabel !== 'string') {
        return []
      }
      const normalizedStatus =
        record.status === 'applied' || record.status === '신청'
          ? 'applied'
          : record.status === 'waiting' || record.status === '대기'
            ? 'waiting'
            : null
      if (!normalizedStatus) return []
      return [
        {
          id: record.id,
          cardId: record.cardId,
          userLabel: record.userLabel,
          status: normalizedStatus,
          riotId: typeof record.riotId === 'string' && record.riotId.trim() !== '' ? record.riotId : '-',
          discordId: typeof record.discordId === 'string' && record.discordId.trim() !== '' ? record.discordId : '-',
        } satisfies InhouseApplication,
      ]
    })
  } catch {
    return []
  }
}

const readInhouseMatchRecords = (): InhouseMatchRecord[] => {
  try {
    const raw = localStorage.getItem(INHOUSE_MATCH_RECORDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (typeof record.id !== 'string' || typeof record.riotId !== 'string' || typeof record.createdAt !== 'number') {
        return []
      }
      if (record.result !== 'win' && record.result !== 'loss') return []
      const riotId = record.riotId.trim()
      if (!riotId) return []
      return [
        {
          id: record.id,
          riotId,
          result: record.result,
          createdAt: record.createdAt,
        } satisfies InhouseMatchRecord,
      ]
    })
  } catch {
    return []
  }
}

const readTeamBrackets = (): Record<string, TeamBracket> => {
  try {
    const raw = localStorage.getItem(TEAM_BRACKETS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const source = parsed as Record<string, unknown>
    return Object.entries(source).reduce<Record<string, TeamBracket>>((acc, [cardId, value]) => {
      if (!value || typeof value !== 'object') return acc
      const record = value as Record<string, unknown>
      if (!Array.isArray(record.groups)) return acc
      const groups = record.groups.flatMap((group, groupIndex) => {
        if (!group || typeof group !== 'object') return []
        const groupRecord = group as Record<string, unknown>
        if (!Array.isArray(groupRecord.matches)) return []
        const matches = groupRecord.matches.flatMap((match, matchIndex) => {
          if (!match || typeof match !== 'object') return []
          const matchRecord = match as Record<string, unknown>
          const winner = matchRecord.winner === 'A' || matchRecord.winner === 'B' ? matchRecord.winner : null
          const readTeam = (key: 'teamA' | 'teamB'): TeamBracketTeam | null => {
            const teamValue = matchRecord[key]
            if (!teamValue || typeof teamValue !== 'object') return null
            const teamRecord = teamValue as Record<string, unknown>
            if (typeof teamRecord.teamNumber !== 'number' || !Array.isArray(teamRecord.members)) return null
            const members = teamRecord.members.flatMap((member) => {
              if (!member || typeof member !== 'object') return []
              const memberRecord = member as Record<string, unknown>
              if (
                typeof memberRecord.id !== 'string' ||
                typeof memberRecord.riotId !== 'string' ||
                typeof memberRecord.discordId !== 'string' ||
                typeof memberRecord.seedNumber !== 'number' ||
                typeof memberRecord.sp !== 'number'
              ) {
                return []
              }
              return [
                {
                  id: memberRecord.id,
                  riotId: memberRecord.riotId,
                  discordId: memberRecord.discordId,
                  seedNumber: memberRecord.seedNumber,
                  sp: memberRecord.sp,
                  highestTier: typeof memberRecord.highestTier === 'string' ? memberRecord.highestTier : 'UNRANKED',
                  currentTier: typeof memberRecord.currentTier === 'string' ? memberRecord.currentTier : 'UNRANKED',
                  profileIconId: typeof memberRecord.profileIconId === 'number' ? memberRecord.profileIconId : null,
                } satisfies TeamBracketMember,
              ]
            })
            return {
              teamNumber: teamRecord.teamNumber,
              teamSp: typeof teamRecord.teamSp === 'number' ? teamRecord.teamSp : 0,
              color:
                typeof teamRecord.color === 'string'
                  ? teamRecord.color
                  : TEAM_SUMMARY_COLORS[(teamRecord.teamNumber - 1) % TEAM_SUMMARY_COLORS.length],
              members,
            }
          }
          return [
            {
              id: typeof matchRecord.id === 'string' ? matchRecord.id : `${groupIndex + 1}-${matchIndex + 1}`,
              stage:
                matchRecord.stage === 'semi' || matchRecord.stage === 'final' || matchRecord.stage === 'lower'
                  ? matchRecord.stage
                  : matchIndex < 2
                    ? 'semi'
                    : matchIndex === 2
                      ? 'final'
                      : 'lower',
              teamA: readTeam('teamA'),
              teamB: readTeam('teamB'),
              winner,
              tournamentCode: typeof matchRecord.tournamentCode === 'string' ? matchRecord.tournamentCode : null,
            } satisfies TeamBracketMatch,
          ]
        })
        return [
          {
            id: typeof groupRecord.id === 'string' ? groupRecord.id : `group-${groupIndex + 1}`,
            label: typeof groupRecord.label === 'string' ? groupRecord.label : `${String.fromCharCode(65 + groupIndex)}조`,
            matches,
          } satisfies TeamBracketGroup,
        ]
      })
      if (groups.length === 0) return acc
      acc[cardId] = {
        cardId,
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
        groups,
      }
      return acc
    }, {})
  } catch {
    return {}
  }
}

const readInhouseBracketRecords = (): InhouseBracketRecord[] => {
  try {
    const raw = localStorage.getItem(INHOUSE_BRACKET_RECORDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (
        typeof record.id !== 'string' ||
        typeof record.cardId !== 'string' ||
        typeof record.title !== 'string' ||
        typeof record.startAt !== 'string' ||
        typeof record.savedAt !== 'number' ||
        !Array.isArray(record.groups)
      ) {
        return []
      }
      const category =
        record.category === 'inhouse-apply' || record.category === 'bet-apply' ? record.category : 'inhouse-apply'
      const groups = record.groups.flatMap((group) => {
        if (!group || typeof group !== 'object') return []
        const groupRecord = group as Record<string, unknown>
        if (typeof groupRecord.groupId !== 'string' || typeof groupRecord.label !== 'string' || !groupRecord.placement) {
          return []
        }
        const placementRecord = groupRecord.placement as Record<string, unknown>
        const parseNumberOrNull = (value: unknown) => {
          if (typeof value === 'number' && Number.isFinite(value)) return value
          if (typeof value === 'string') {
            const parsedValue = Number.parseInt(value, 10)
            if (Number.isFinite(parsedValue)) return parsedValue
          }
          return null
        }
        const teams = Array.isArray(groupRecord.teams)
          ? groupRecord.teams.flatMap((team) => {
              if (!team || typeof team !== 'object') return []
              const teamRecord = team as Record<string, unknown>
              if (typeof teamRecord.teamNumber !== 'number' || !Array.isArray(teamRecord.members)) return []
              const members = teamRecord.members.flatMap((member) => {
                if (typeof member === 'string') {
                  return [
                    {
                      riotId: member,
                      highestTier: '-',
                    },
                  ]
                }
                if (!member || typeof member !== 'object') return []
                const memberRecord = member as Record<string, unknown>
                if (typeof memberRecord.riotId !== 'string') return []
                return [
                  {
                    riotId: memberRecord.riotId,
                    highestTier: typeof memberRecord.highestTier === 'string' ? memberRecord.highestTier : '-',
                  },
                ]
              })
              return [
                {
                  teamNumber: teamRecord.teamNumber,
                  members,
                } satisfies InhouseBracketTeamRecord,
              ]
            })
          : []
        const matches = Array.isArray(groupRecord.matches)
          ? groupRecord.matches.flatMap((match) => {
              if (!match || typeof match !== 'object') return []
              const matchRecord = match as Record<string, unknown>
              if (typeof matchRecord.matchId !== 'string') return []
              const matchId = matchRecord.matchId
              const inferredStage: TeamBracketMatch['stage'] =
                matchRecord.stage === 'semi' || matchRecord.stage === 'final' || matchRecord.stage === 'lower'
                  ? matchRecord.stage
                  : matchId.endsWith('-final')
                    ? 'final'
                    : matchId.endsWith('-lower')
                      ? 'lower'
                      : 'semi'
              const teamANumber = parseNumberOrNull(matchRecord.teamANumber)
              const teamBNumber = parseNumberOrNull(matchRecord.teamBNumber)
              const winnerTeamNumber =
                parseNumberOrNull(matchRecord.winnerTeamNumber) ??
                (matchRecord.winner === 'A' ? teamANumber : matchRecord.winner === 'B' ? teamBNumber : null)
              return [
                {
                  matchId,
                  stage: inferredStage,
                  teamANumber,
                  teamBNumber,
                  winnerTeamNumber,
                  tournamentCode: typeof matchRecord.tournamentCode === 'string' ? matchRecord.tournamentCode : null,
                } satisfies InhouseBracketMatchRecord,
              ]
            })
          : []
        return [
          {
            groupId: groupRecord.groupId,
            label: groupRecord.label,
            placement: {
              firstTeamNumber: parseNumberOrNull(placementRecord.firstTeamNumber),
              secondTeamNumber: parseNumberOrNull(placementRecord.secondTeamNumber),
              thirdTeamNumber: parseNumberOrNull(placementRecord.thirdTeamNumber),
              fourthTeamNumber: parseNumberOrNull(placementRecord.fourthTeamNumber),
            },
            teams,
            matches,
          },
        ]
      })
      return [
        {
          id: record.id,
          cardId: record.cardId,
          category,
          title: record.title,
          startAt: record.startAt,
          savedAt: record.savedAt,
          groups,
        } satisfies InhouseBracketRecord,
      ]
    })
  } catch {
    return []
  }
}

const readMatchDetailIdMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(MATCH_DETAIL_ID_MAP_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === 'string' && value.trim() !== '') acc[key] = value.trim()
      return acc
    }, {})
  } catch {
    return {}
  }
}

const readNoticeItems = (): NoticeItem[] => {
  try {
    const raw = localStorage.getItem(NOTICE_ITEMS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (typeof record.id !== 'string' || typeof record.title !== 'string' || typeof record.content !== 'string') {
        return []
      }
      const createdAt = typeof record.createdAt === 'number' && Number.isFinite(record.createdAt) ? record.createdAt : Date.now()
      const authorLabel =
        typeof record.authorLabel === 'string' && record.authorLabel.trim() !== '' ? record.authorLabel : '관리자'
      return [
        {
          id: record.id,
          title: record.title,
          content: record.content,
          createdAt,
          authorLabel,
        } satisfies NoticeItem,
      ]
    })
  } catch {
    return []
  }
}

function App() {
  type RecordCategoryFilter = InhouseCategoryValue | 'detail-record' | 'stats'
  const MEMBER_MENU = '멤버'
  const TEAM_DRAW_MENU = '시드'
  const TEAM_SELECT_MENU = '팀 선정'
  const TEAM_BRACKET_MENU = '대진표'
  const readMenuFromHash = () => {
    const rawHash = window.location.hash.replace(/^#/, '')
    if (!rawHash) return '홈'
    try {
      const decoded = decodeURIComponent(rawHash).trim()
      return decoded || '홈'
    } catch {
      return '홈'
    }
  }
  const readLastActiveMenu = () => {
    try {
      return localStorage.getItem(LAST_ACTIVE_MENU_STORAGE_KEY)?.trim() || '홈'
    } catch {
      return '홈'
    }
  }

  const [activeMenu, setActiveMenu] = useState(() => {
    const menuFromHash = readMenuFromHash()
    if (menuFromHash !== '홈') return menuFromHash
    return readLastActiveMenu()
  })
  const [isLoginPage, setIsLoginPage] = useState(true)
  const [isUserInfoPage, setIsUserInfoPage] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'pending'>('login')
  const [pendingAccountId, setPendingAccountId] = useState('')
  const [currentUserLabel, setCurrentUserLabel] = useState('')
  const [isAdminSession, setIsAdminSession] = useState(false)
  const [userInfoAccount, setUserInfoAccount] = useState('')
  const [userInfoDiscord, setUserInfoDiscord] = useState('')
  const [userInfoRiotId, setUserInfoRiotId] = useState('')
  const [userInfoSeason, setUserInfoSeason] = useState('')
  const [userInfoTier, setUserInfoTier] = useState('')
  const [userInfoLp, setUserInfoLp] = useState('')
  const [userInfoMainLine, setUserInfoMainLine] = useState('')
  const [userInfoApprovalStatus, setUserInfoApprovalStatus] = useState<'pending' | 'approved'>('pending')
  const [userInfoFeedback, setUserInfoFeedback] = useState('')
  const [userInfoFeedbackType, setUserInfoFeedbackType] = useState<'error' | 'success'>('error')
  const [, setUsersVersion] = useState(0)
  const [adminCategory, setAdminCategory] = useState<'유저관리' | '가입승인'>('가입승인')
  const [userTypeFilter, setUserTypeFilter] = useState<'전체' | '관리자' | '운영진' | '일반'>('전체')

  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [signupDiscordId, setSignupDiscordId] = useState('')
  const [signupRiotId, setSignupRiotId] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [signupSeason, setSignupSeason] = useState('')
  const [signupTier, setSignupTier] = useState('')
  const [signupLp, setSignupLp] = useState('')
  const [signupMainLine, setSignupMainLine] = useState('')
  const [authFeedback, setAuthFeedback] = useState('')
  const [authFeedbackType, setAuthFeedbackType] = useState<'error' | 'success'>('error')
  const [profileIconByRiotId, setProfileIconByRiotId] = useState<Record<string, number | null>>({})
  const [rankedSoloByRiotId, setRankedSoloByRiotId] = useState<Record<string, RankedEntry | null>>({})
  const [currentTierByRiotId, setCurrentTierByRiotId] = useState<Record<string, string>>({})
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTargetRiotId, setEditTargetRiotId] = useState('')
  const [editAccountLabel, setEditAccountLabel] = useState('')
  const [editDiscordId, setEditDiscordId] = useState('')
  const [editRiotId, setEditRiotId] = useState('')
  const [editSeason, setEditSeason] = useState('')
  const [editTier, setEditTier] = useState('')
  const [editLp, setEditLp] = useState('')
  const [editMainLine, setEditMainLine] = useState('')
  const [editUserType, setEditUserType] = useState<'운영진' | '일반'>('일반')
  const [editApprovalStatus, setEditApprovalStatus] = useState<'pending' | 'approved'>('approved')
  const [editFeedback, setEditFeedback] = useState('')
  const [editFeedbackType, setEditFeedbackType] = useState<'error' | 'success'>('error')

  const [recordInput, setRecordInput] = useState('')
  const [homeSearchInput, setHomeSearchInput] = useState('')
  const [recordLoading, setRecordLoading] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [isRecordErrorDetailOpen, setIsRecordErrorDetailOpen] = useState(false)
  const [homeMvpTopRows, setHomeMvpTopRows] = useState<HomeMvpTopRow[]>([])
  const [homeKdaTopRows, setHomeKdaTopRows] = useState<HomeKdaTopRow[]>([])
  const [homeTopLoading, setHomeTopLoading] = useState(false)
  const [homeTopError, setHomeTopError] = useState('')
  const [recordData, setRecordData] = useState<RiotProfileResponse | null>(null)
  const [recordPersistedStats, setRecordPersistedStats] = useState<PersistedPlayerStats | null>(null)
  const [isInhouseCreateModalOpen, setIsInhouseCreateModalOpen] = useState(false)
  const [inhouseCreateTitle, setInhouseCreateTitle] = useState('')
  const [inhouseCreateStartAt, setInhouseCreateStartAt] = useState('')
  const [inhouseCreateFeedback, setInhouseCreateFeedback] = useState('')
  const [isInhouseApplyModalOpen, setIsInhouseApplyModalOpen] = useState(false)
  const [inhouseApplyTargetCardId, setInhouseApplyTargetCardId] = useState('')
  const [isInhouseEditModalOpen, setIsInhouseEditModalOpen] = useState(false)
  const [inhouseEditTargetId, setInhouseEditTargetId] = useState('')
  const [inhouseEditTitle, setInhouseEditTitle] = useState('')
  const [inhouseEditStartAt, setInhouseEditStartAt] = useState('')
  const [inhouseEditFeedback, setInhouseEditFeedback] = useState('')
  const [inhouseCards, setInhouseCards] = useState<InhouseCard[]>(() => readInhouseCards())
  const [inhouseApplications, setInhouseApplications] = useState<InhouseApplication[]>(() => readInhouseApplications())
  const [inhouseMatchRecords, setInhouseMatchRecords] = useState<InhouseMatchRecord[]>(() => readInhouseMatchRecords())
  const [inhouseBracketRecords, setInhouseBracketRecords] = useState<InhouseBracketRecord[]>(() => readInhouseBracketRecords())
  const [inhouseCategory, setInhouseCategory] = useState<InhouseCategoryValue>(INHOUSE_CATEGORY_OPTIONS[0].value)
  const [teamDrawCardId, setTeamDrawCardId] = useState('')
  const [teamSelectAssignments, setTeamSelectAssignments] = useState<Record<number, Record<number, string>>>({})
  const [teamSelectPickerSlot, setTeamSelectPickerSlot] = useState<{ seedNumber: number; teamNumber: number } | null>(null)
  const [teamSelectPickerMemberId, setTeamSelectPickerMemberId] = useState('')
  const [teamBracketByCardId, setTeamBracketByCardId] = useState<Record<string, TeamBracket>>(() => readTeamBrackets())
  const [tournamentCodeLoadingByMatchId, setTournamentCodeLoadingByMatchId] = useState<Record<string, boolean>>({})
  const [recordCategoryFilter, setRecordCategoryFilter] = useState<RecordCategoryFilter>('inhouse-apply')
  const [recordStatsView, setRecordStatsView] = useState<'winrate' | 'games' | 'kda' | 'damage'>('winrate')
  const [recordLeaderboardRows, setRecordLeaderboardRows] = useState<RecordLeaderboardRow[]>([])
  const [recordStatsLoading, setRecordStatsLoading] = useState(false)
  const [recordStatsError, setRecordStatsError] = useState('')
  const [expandedRecordId, setExpandedRecordId] = useState('')
  const [detailRecordId, setDetailRecordId] = useState('')
  const [detailGroupId, setDetailGroupId] = useState('')
  const [isMatchDetailModalOpen, setIsMatchDetailModalOpen] = useState(false)
  const [matchDetailModalMode, setMatchDetailModalMode] = useState<'input' | 'view'>('input')
  const [matchDetailTargetKey, setMatchDetailTargetKey] = useState('')
  const [matchDetailInput, setMatchDetailInput] = useState('')
  const [matchDetailTitle, setMatchDetailTitle] = useState('')
  const [matchDetailLoading, setMatchDetailLoading] = useState(false)
  const [matchDetailError, setMatchDetailError] = useState('')
  const [matchDetailData, setMatchDetailData] = useState<RiotMatchDetailResponse | null>(null)
  const [matchDetailIdByKey, setMatchDetailIdByKey] = useState<Record<string, string>>(() => readMatchDetailIdMap())
  const [noticeItems, setNoticeItems] = useState<NoticeItem[]>(() => readNoticeItems())
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false)
  const [selectedNoticeId, setSelectedNoticeId] = useState('')
  const [noticeTitleInput, setNoticeTitleInput] = useState('')
  const [noticeContentInput, setNoticeContentInput] = useState('')
  const [noticeFeedback, setNoticeFeedback] = useState('')
  const [summonerSpellIconById, setSummonerSpellIconById] = useState<Record<number, string>>({})
  const [perkIconById, setPerkIconById] = useState<Record<number, string>>({})
  const hasLoadedInhouseCards = useRef(false)
  const hasLoadedInhouseApplications = useRef(false)
  const hasLoadedInhouseMatchRecords = useRef(false)
  const hasLoadedInhouseBracketRecords = useRef(false)
  const hasLoadedTeamBrackets = useRef(false)
  const hasLoadedNoticeItems = useRef(false)
  const hasInjectedDummyApplicantsByCardId = useRef<Record<string, true>>({})
  const isMenuHistoryPop = useRef(false)

  const baseMenus = ['홈', '전적', '내전신청', '기록']
  const visibleMenus = isAdminSession ? [...baseMenus, '관리'] : baseMenus
  const currentInhouseCategory =
    INHOUSE_CATEGORY_OPTIONS.find((category) => category.value === inhouseCategory) ?? INHOUSE_CATEGORY_OPTIONS[0]
  const currentInhouseCards = inhouseCards
    .filter((card) => card.category === inhouseCategory)
    .sort((a, b) => {
      const now = Date.now()
      const aTime = parseInhouseStartAtTimestamp(a.startAt)
      const bTime = parseInhouseStartAtTimestamp(b.startAt)
      const toDistance = (time: number) => {
        if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY
        const diff = time - now
        return diff >= 0 ? diff : Number.POSITIVE_INFINITY / 2 + Math.abs(diff)
      }
      return toDistance(aTime) - toDistance(bTime)
    })
  const homeUpcomingInhouseCards = inhouseCards
    .filter((card) => card.category === 'inhouse-apply')
    .map((card) => ({
      ...card,
      timestamp: parseInhouseStartAtTimestamp(card.startAt),
    }))
    .sort((a, b) => {
      const now = Date.now()
      const toDistance = (time: number) => {
        if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY
        const diff = time - now
        return diff >= 0 ? diff : Number.POSITIVE_INFINITY / 2 + Math.abs(diff)
      }
      return toDistance(a.timestamp) - toDistance(b.timestamp)
    })
    .slice(0, 3)
  const currentTeamDrawCard = inhouseCards.find((card) => card.id === teamDrawCardId) ?? null
  const currentSeedMemberLimit = currentTeamDrawCard
    ? getMaxSeedMemberCountByStartAt(currentTeamDrawCard.startAt)
    : DEFAULT_MAX_SEED_MEMBER_COUNT
  const currentTeamBracket = teamDrawCardId ? teamBracketByCardId[teamDrawCardId] ?? null : null
  const sortedBracketRecords = [...inhouseBracketRecords].sort((a, b) => b.savedAt - a.savedAt)
  const filteredBracketRecords =
    recordCategoryFilter === 'detail-record'
      ? sortedBracketRecords
      : recordCategoryFilter === 'stats'
        ? []
        : sortedBracketRecords.filter((record) => record.category === recordCategoryFilter)
  const detailRecordCards = sortedBracketRecords.flatMap((record) =>
    record.groups.map((group) => ({
      id: `${record.id}:${group.groupId}`,
      recordId: record.id,
      groupId: group.groupId,
      title: record.title,
      startAt: record.startAt,
      groupLabel: group.label,
    })),
  )
  const teamDrawApplications = teamDrawCardId
    ? inhouseApplications.filter((item) => item.cardId === teamDrawCardId)
    : []
  const teamDrawMembers = teamDrawApplications.map((application) => ({
    application,
    riotId: application.riotId,
    discordId: application.discordId,
  }))
  const appliedTeamDrawMembers = teamDrawMembers.filter((item) => item.application.status === 'applied')
  const waitingTeamDrawMembers = teamDrawMembers.filter((item) => item.application.status === 'waiting')
  const seededAppliedTeamDrawMembers = appliedTeamDrawMembers.slice(0, currentSeedMemberLimit)
  const inhouseStatByRiotId = inhouseMatchRecords.reduce<Record<string, InhouseStat>>((acc, record) => {
    const key = normalizeRiotIdValue(record.riotId) ?? record.riotId.trim().toLowerCase()
    const target = acc[key] ?? { wins: 0, losses: 0, winRate: 0, winStreak: 0 }
    if (record.result === 'win') target.wins += 1
    if (record.result === 'loss') target.losses += 1
    acc[key] = target
    return acc
  }, {})
  Object.entries(inhouseStatByRiotId).forEach(([key, stat]) => {
    const targetRecords = inhouseMatchRecords
      .filter((record) => (normalizeRiotIdValue(record.riotId) ?? record.riotId.trim().toLowerCase()) === key)
      .sort((a, b) => b.createdAt - a.createdAt)
    let streak = 0
    for (const record of targetRecords) {
      if (record.result !== 'win') break
      streak += 1
    }
    const total = stat.wins + stat.losses
    stat.winRate = total > 0 ? Math.round((stat.wins / total) * 100) : 0
    stat.winStreak = streak
  })
  useEffect(() => {
    let cancelled = false
    const toIconUrl = (iconPath: string) => {
      const normalized = iconPath.replace(/^\/lol-game-data\/assets/i, '').toLowerCase()
      return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default${normalized}`
    }
    const loadStaticIcons = async () => {
      try {
        const [spellsRes, perksRes] = await Promise.all([
          fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json'),
          fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json'),
        ])
        if (!spellsRes.ok || !perksRes.ok) return
        const spellsData = (await spellsRes.json()) as Array<{ id?: number; iconPath?: string }>
        const perksData = (await perksRes.json()) as Array<{ id?: number; iconPath?: string }>
        if (cancelled) return
        const spellMap = spellsData.reduce<Record<number, string>>((acc, spell) => {
          if (typeof spell.id !== 'number' || typeof spell.iconPath !== 'string') return acc
          acc[spell.id] = toIconUrl(spell.iconPath)
          return acc
        }, {})
        const perkMap = perksData.reduce<Record<number, string>>((acc, perk) => {
          if (typeof perk.id !== 'number' || typeof perk.iconPath !== 'string') return acc
          acc[perk.id] = toIconUrl(perk.iconPath)
          return acc
        }, {})
        setSummonerSpellIconById(spellMap)
        setPerkIconById(perkMap)
      } catch {
        // ignore static asset load errors
      }
    }
    void loadStaticIcons()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      !isAdminSession &&
      (activeMenu === '관리' ||
        activeMenu === MEMBER_MENU ||
        activeMenu === TEAM_DRAW_MENU ||
        activeMenu === TEAM_SELECT_MENU ||
        activeMenu === TEAM_BRACKET_MENU)
    ) {
      setActiveMenu('홈')
    }
  }, [activeMenu, isAdminSession, MEMBER_MENU, TEAM_DRAW_MENU, TEAM_SELECT_MENU, TEAM_BRACKET_MENU])

  useEffect(() => {
    if (activeMenu === '관리') {
      setAdminCategory('가입승인')
      setUserTypeFilter('전체')
    }
  }, [activeMenu])

  useEffect(() => {
    if (adminCategory === '유저관리') {
      setUserTypeFilter('전체')
    }
  }, [adminCategory])

  useEffect(() => {
    if (activeMenu === '기록') return
    setExpandedRecordId('')
    setDetailRecordId('')
    setDetailGroupId('')
  }, [activeMenu])

  useEffect(() => {
    if (activeMenu !== '기록') return
    setRecordCategoryFilter('inhouse-apply')
  }, [activeMenu])

  useEffect(() => {
    if (activeMenu !== '기록' || recordCategoryFilter !== 'stats') return
    let cancelled = false
    const loadStats = async () => {
      setRecordStatsLoading(true)
      setRecordStatsError('')
      try {
        const response = await fetch('/api/stats/leaderboard')
        const data = (await response.json()) as { error?: string; rows?: RecordLeaderboardRow[] }
        if (cancelled) return
        if (!response.ok) {
          setRecordLeaderboardRows([])
          setRecordStatsError(data.error ?? '통계 로딩에 실패했습니다.')
          return
        }
        setRecordLeaderboardRows(Array.isArray(data.rows) ? data.rows : [])
      } catch {
        if (cancelled) return
        setRecordLeaderboardRows([])
        setRecordStatsError('통계 로딩 중 오류가 발생했습니다.')
      } finally {
        if (!cancelled) setRecordStatsLoading(false)
      }
    }
    void loadStats()
    return () => {
      cancelled = true
    }
  }, [activeMenu, recordCategoryFilter])

  useEffect(() => {
    if (activeMenu !== '홈') return
    let cancelled = false
    const loadHomeTop = async () => {
      setHomeTopLoading(true)
      setHomeTopError('')
      try {
        const response = await fetch('/api/stats/home-top')
        const data = (await response.json()) as {
          error?: string
          mvpTopRows?: HomeMvpTopRow[]
          kdaTopRows?: HomeKdaTopRow[]
        }
        if (cancelled) return
        if (!response.ok) {
          setHomeMvpTopRows([])
          setHomeKdaTopRows([])
          setHomeTopError(data.error ?? '홈 통계를 불러오지 못했습니다.')
          return
        }
        setHomeMvpTopRows(Array.isArray(data.mvpTopRows) ? data.mvpTopRows : [])
        setHomeKdaTopRows(Array.isArray(data.kdaTopRows) ? data.kdaTopRows : [])
      } catch {
        if (cancelled) return
        setHomeMvpTopRows([])
        setHomeKdaTopRows([])
        setHomeTopError('홈 통계 로딩 중 오류가 발생했습니다.')
      } finally {
        if (!cancelled) setHomeTopLoading(false)
      }
    }
    void loadHomeTop()
    return () => {
      cancelled = true
    }
  }, [activeMenu])

  useEffect(() => {
    setTeamSelectAssignments({})
    setTeamSelectPickerSlot(null)
    setTeamSelectPickerMemberId('')
  }, [teamDrawCardId])

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { menu?: string; teamDrawCardId?: string } | null
      if (!state || typeof state.menu !== 'string') return
      isMenuHistoryPop.current = true
      setActiveMenu(state.menu)
      if (typeof state.teamDrawCardId === 'string') {
        setTeamDrawCardId(state.teamDrawCardId)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LAST_ACTIVE_MENU_STORAGE_KEY, activeMenu)
    } catch {
      // ignore storage errors
    }
    if (isMenuHistoryPop.current) {
      isMenuHistoryPop.current = false
      return
    }
    window.history.pushState(
      {
        menu: activeMenu,
        teamDrawCardId:
          activeMenu === MEMBER_MENU ||
          activeMenu === TEAM_DRAW_MENU ||
          activeMenu === TEAM_SELECT_MENU ||
          activeMenu === TEAM_BRACKET_MENU
            ? teamDrawCardId
            : '',
      },
      '',
      `#${encodeURIComponent(activeMenu)}`,
    )
  }, [activeMenu, teamDrawCardId, MEMBER_MENU, TEAM_DRAW_MENU, TEAM_SELECT_MENU, TEAM_BRACKET_MENU])

  useEffect(() => {
    let isCancelled = false
    const hydrateFromDb = async () => {
      try {
        const keyQuery = encodeURIComponent(PERSIST_STATE_KEYS.join(','))
        const response = await fetch(`/api/persist/state-batch?keys=${keyQuery}`)
        const data = (await response.json()) as { states?: Record<string, string | null> }
        if (!response.ok || !data.states || isCancelled) return

        PERSIST_STATE_KEYS.forEach((key) => {
          const stateValue = data.states?.[key]
          if (typeof stateValue === 'string') {
            localStorage.setItem(key, stateValue)
          }
        })
        if (isCancelled) return

        setInhouseCards(readInhouseCards())
        setInhouseApplications(readInhouseApplications())
        setInhouseMatchRecords(readInhouseMatchRecords())
        setInhouseBracketRecords(readInhouseBracketRecords())
        setTeamBracketByCardId(readTeamBrackets())
        setMatchDetailIdByKey(readMatchDetailIdMap())
        setNoticeItems(readNoticeItems())
        setUsersVersion((prev) => prev + 1)
      } catch {
        // ignore hydration failures and keep local data
      }
    }
    void hydrateFromDb()
    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedInhouseCards.current) {
      hasLoadedInhouseCards.current = true
      return
    }
    localStorage.setItem(INHOUSE_CARDS_STORAGE_KEY, JSON.stringify(inhouseCards))
    persistStateToServer(INHOUSE_CARDS_STORAGE_KEY, inhouseCards)
  }, [inhouseCards])

  useEffect(() => {
    if (!hasLoadedInhouseApplications.current) {
      hasLoadedInhouseApplications.current = true
      return
    }
    localStorage.setItem(INHOUSE_APPLICATIONS_STORAGE_KEY, JSON.stringify(inhouseApplications))
    persistStateToServer(INHOUSE_APPLICATIONS_STORAGE_KEY, inhouseApplications)
  }, [inhouseApplications])

  useEffect(() => {
    if (!isAdminSession || !teamDrawCardId) return
    if (
      activeMenu !== MEMBER_MENU &&
      activeMenu !== TEAM_DRAW_MENU &&
      activeMenu !== TEAM_SELECT_MENU &&
      activeMenu !== TEAM_BRACKET_MENU
    )
      return
    if (hasInjectedDummyApplicantsByCardId.current[teamDrawCardId]) return
    if (!currentTeamDrawCard) return
    const dummyTargetByStartAt: Record<string, number> = {
      '2026.03.23 12:30': 20,
      '2026.03.01 10:30': 60,
    }
    const targetDummyCount = dummyTargetByStartAt[currentTeamDrawCard.startAt.trim()]
    if (!targetDummyCount) return
    const appliedCount = inhouseApplications.filter(
      (item) => item.cardId === teamDrawCardId && item.status === 'applied',
    ).length
    if (appliedCount >= targetDummyCount) {
      hasInjectedDummyApplicantsByCardId.current[teamDrawCardId] = true
      return
    }
    const needCount = targetDummyCount - appliedCount
    const dummyApplicants: InhouseApplication[] = Array.from({ length: needCount }, (_, index) => {
      const order = index + 1
      return {
        id: `dummy-${Date.now()}-${order}`,
        cardId: teamDrawCardId,
        userLabel: `Dummy${order}#KR1`,
        status: 'applied',
        riotId: `Dummy${order}#KR1`,
        discordId: `더미${order}`,
      }
    })
    setInhouseApplications((prev) => [...prev, ...dummyApplicants])
    hasInjectedDummyApplicantsByCardId.current[teamDrawCardId] = true
  }, [
    activeMenu,
    currentTeamDrawCard,
    inhouseApplications,
    isAdminSession,
    teamDrawCardId,
    MEMBER_MENU,
    TEAM_DRAW_MENU,
    TEAM_SELECT_MENU,
    TEAM_BRACKET_MENU,
  ])

  useEffect(() => {
    if (!hasLoadedInhouseMatchRecords.current) {
      hasLoadedInhouseMatchRecords.current = true
      return
    }
    localStorage.setItem(INHOUSE_MATCH_RECORDS_STORAGE_KEY, JSON.stringify(inhouseMatchRecords))
    persistStateToServer(INHOUSE_MATCH_RECORDS_STORAGE_KEY, inhouseMatchRecords)
  }, [inhouseMatchRecords])

  useEffect(() => {
    if (!hasLoadedInhouseBracketRecords.current) {
      hasLoadedInhouseBracketRecords.current = true
      return
    }
    localStorage.setItem(INHOUSE_BRACKET_RECORDS_STORAGE_KEY, JSON.stringify(inhouseBracketRecords))
    persistStateToServer(INHOUSE_BRACKET_RECORDS_STORAGE_KEY, inhouseBracketRecords)
  }, [inhouseBracketRecords])

  useEffect(() => {
    if (!hasLoadedTeamBrackets.current) {
      hasLoadedTeamBrackets.current = true
      return
    }
    localStorage.setItem(TEAM_BRACKETS_STORAGE_KEY, JSON.stringify(teamBracketByCardId))
    persistStateToServer(TEAM_BRACKETS_STORAGE_KEY, teamBracketByCardId)
  }, [teamBracketByCardId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return
      const record = parsed as Record<string, unknown>
      if (typeof record.userLabel !== 'string' || typeof record.isAdmin !== 'boolean') return
      const key = record.userLabel.trim().toLowerCase()
      const elevatedByRole =
        key !== '' &&
        readSignupProfiles().some((profile) => {
          const accountKey = (profile.accountLabel || profile.riotId).trim().toLowerCase()
          const riotKey = profile.riotId.trim().toLowerCase()
          return (
            (accountKey === key || riotKey === key) &&
            profile.approvalStatus === 'approved' &&
            profile.userType === '운영진'
          )
        })
      setCurrentUserLabel(record.userLabel)
      setIsAdminSession(record.isAdmin || elevatedByRole)
      setIsLoginPage(false)
      setIsUserInfoPage(false)
    } catch {
      // ignore invalid local session
    }
  }, [])

  const formatRank = (entry: RankedEntry | null) => {
    if (!entry) return 'UNRANKED'
    return `${entry.tier} ${entry.rank}`
  }

  const formatWinRate = (entry: RankedEntry | null) => {
    if (!entry) return '-'
    const total = entry.wins + entry.losses
    if (total === 0) return '0%'
    return `${Math.round((entry.wins / total) * 100)}%`
  }

  const getWinRateTierClass = (winRateValue: number | null | undefined) => {
    if (typeof winRateValue !== 'number' || Number.isNaN(winRateValue)) return 'winrate-tier-1'
    if (winRateValue >= 90) return 'winrate-tier-4'
    if (winRateValue >= 70) return 'winrate-tier-3'
    if (winRateValue >= 50) return 'winrate-tier-2'
    return 'winrate-tier-1'
  }

  const formatCurrentTierText = (entry: RankedEntry | null) => {
    if (!entry) return 'UNRANKED'
    const tierKey = entry.tier.trim().toUpperCase()
    const tierLabel = TIER_NAME_KR[tierKey] ?? tierKey
    const isMasterPlus = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tierKey)
    if (isMasterPlus) {
      return `${tierLabel} ${entry.leaguePoints}LP`
    }
    const rank = entry.rank && entry.rank !== 'NA' ? rankToNumber(entry.rank) : ''
    return rank ? `${tierLabel} ${rank}` : tierLabel
  }

  const formatHighestTierChipText = (seasonPeakTier: string) => {
    const parsed = parseSeasonPeakTier(seasonPeakTier)
    const option = findTierOption(parsed.tier)
    if (option) {
      if (option.requiresLp && parsed.lp) return `${option.label} ${parsed.lp}LP`
      return option.label
    }
    const fallback = seasonPeakTier.replace(/\bS(1[0-6]|[2-9])\b/gi, '').replace(/\d+\s*LP/gi, '').trim()
    return fallback || 'UNRANKED'
  }

  const getTierGroupIndex = (tier: string) => {
    const source = tier.trim().toUpperCase()
    const order = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
    return order.indexOf(source)
  }

  const getTierPoint = (tier: string, division: number | null, lp: number) => {
    const groupIndex = getTierGroupIndex(tier)
    if (groupIndex < 0) return 0
    const base = groupIndex * 4
    const isMasterPlus = groupIndex >= 7
    if (isMasterPlus) {
      // 마스터 이상은 100LP를 1티어 단계로 환산
      return base + lp / 100
    }
    if (!division || Number.isNaN(division)) return base
    const clampedDivision = Math.max(1, Math.min(4, division))
    return base + (4 - clampedDivision)
  }

  const getCurrentTierPoint = (entry: RankedEntry | null) => {
    if (!entry) return 0
    const tier = entry.tier.trim().toUpperCase()
    const division = Number(rankToNumber(entry.rank))
    const lp = Number.isFinite(entry.leaguePoints) ? entry.leaguePoints : 0
    return getTierPoint(tier, Number.isNaN(division) ? null : division, lp)
  }

  const getHighestTierPoint = (seasonPeakTier: string) => {
    const parsed = parseSeasonPeakTier(seasonPeakTier)
    if (!parsed.tier) return 0
    const [tier, divisionRaw] = parsed.tier.split('_')
    const division = divisionRaw ? Number(divisionRaw) : null
    const lp = parsed.lp ? Number(parsed.lp) : 0
    return getTierPoint(tier, division, Number.isNaN(lp) ? 0 : lp)
  }

  const getInhouseStatByRiotId = (riotId: string) => {
    const key = normalizeRiotIdValue(riotId) ?? riotId.trim().toLowerCase()
    return inhouseStatByRiotId[key] ?? { wins: 0, losses: 0, winRate: 0, winStreak: 0 }
  }

  const calculateSeedSpByInputs = (riotId: string, rankedSolo: RankedEntry | null) => {
    const highestTierPoint = getHighestTierPoint(getSignupSeasonPeakTierFromRiotId(riotId))
    const rawCurrentTierPoint = getCurrentTierPoint(rankedSolo)
    const currentTierPoint = rawCurrentTierPoint > 0 ? rawCurrentTierPoint : highestTierPoint * 0.8
    const inhouseStat = getInhouseStatByRiotId(riotId)
    // 승률/연승은 티어 변화 대비 절반 수준 영향으로 축소
    const winRateScore = (inhouseStat.winRate - 50) * 0.09
    const winStreakScore = Math.min(8, inhouseStat.winStreak) * 0.8
    const total = (currentTierPoint * 2 + highestTierPoint * 1.6 + winRateScore + winStreakScore) / 3
    return Math.max(0, Math.round(total * 10) / 10)
  }

  const calculateSeedSp = (riotId: string) => calculateSeedSpByInputs(riotId, rankedSoloByRiotId[riotId] ?? null)

  const sortedSeedMembers = [...seededAppliedTeamDrawMembers].sort((a, b) => calculateSeedSp(b.riotId) - calculateSeedSp(a.riotId))
  const seedGroupSize = Math.max(1, Math.ceil(sortedSeedMembers.length / 5))
  const seededMembersWithGroup = sortedSeedMembers.map((item, index) => ({
    ...item,
    seedNumber: Math.min(5, Math.floor(index / seedGroupSize) + 1),
  }))
  const seededRows = Array.from({ length: 5 }, (_, rowIndex) => ({
    seedNumber: rowIndex + 1,
    members: seededMembersWithGroup.filter((item) => item.seedNumber === rowIndex + 1),
  }))
  const visibleSeedRows = seededRows.filter((row) => row.members.length > 0)
  const teamSelectMembers = seededMembersWithGroup
  const teamCount = Math.max(1, seedGroupSize)
  const getSeedMembers = (seedNumber: number) => seededRows[seedNumber - 1]?.members ?? []
  const getAssignedIdsForSeed = (seedNumber: number) =>
    Object.values(teamSelectAssignments[seedNumber] ?? {}).filter((value): value is string => typeof value === 'string')
  const getAvailableMembersForSeedSlot = (seedNumber: number, teamNumber: number) => {
    const members = getSeedMembers(seedNumber)
    const assignedIds = new Set(getAssignedIdsForSeed(seedNumber))
    const currentAssignedId = teamSelectAssignments[seedNumber]?.[teamNumber]
    if (currentAssignedId) assignedIds.delete(currentAssignedId)
    return members.filter((member) => !assignedIds.has(member.application.id))
  }
  const getTeamSelectSlotMember = (seedNumber: number, teamNumber: number) => {
    const members = getSeedMembers(seedNumber)
    if (seedNumber === 1) {
      return members[teamNumber - 1] ?? null
    }
    const assignedId = teamSelectAssignments[seedNumber]?.[teamNumber]
    if (!assignedId) return null
    return members.find((member) => member.application.id === assignedId) ?? null
  }
  const openTeamSelectInlinePicker = (seedNumber: number, teamNumber: number) => {
    const options = getAvailableMembersForSeedSlot(seedNumber, teamNumber)
    if (options.length === 0) {
      window.alert('선택 가능한 인원이 없습니다.')
      return
    }
    setTeamSelectPickerSlot({ seedNumber, teamNumber })
    setTeamSelectPickerMemberId(options[0].application.id)
  }
  const handleConfirmTeamSelectInlineAssign = () => {
    if (!teamSelectPickerSlot || !teamSelectPickerMemberId) return
    setTeamSelectAssignments((prev) => ({
      ...prev,
      [teamSelectPickerSlot.seedNumber]: {
        ...(prev[teamSelectPickerSlot.seedNumber] ?? {}),
        [teamSelectPickerSlot.teamNumber]: teamSelectPickerMemberId,
      },
    }))
    setTeamSelectPickerSlot(null)
    setTeamSelectPickerMemberId('')
  }
  const handleCancelTeamSelectAssignment = (seedNumber: number, teamNumber: number) => {
    setTeamSelectAssignments((prev) => {
      const seedAssignments = prev[seedNumber]
      if (!seedAssignments || !seedAssignments[teamNumber]) return prev
      const nextSeedAssignments = { ...seedAssignments }
      delete nextSeedAssignments[teamNumber]
      if (Object.keys(nextSeedAssignments).length === 0) {
        const next = { ...prev }
        delete next[seedNumber]
        return next
      }
      return {
        ...prev,
        [seedNumber]: nextSeedAssignments,
      }
    })
  }
  const teamColumns = Array.from({ length: teamCount }, (_, teamIndex) => {
    const slots = Array.from({ length: 5 }, (_, seedIndex) => {
      return {
        seedNumber: seedIndex + 1,
        member: getTeamSelectSlotMember(seedIndex + 1, teamIndex + 1),
      }
    })
    const teamSp = Math.round(
      slots.reduce((total, slot) => total + (slot.member ? calculateSeedSp(slot.member.riotId) : 0), 0) * 10,
    ) / 10
    const memberCount = slots.filter((slot) => slot.member !== null).length
    return {
      teamNumber: teamIndex + 1,
      memberCount,
      teamSp,
      color: TEAM_SUMMARY_COLORS[teamIndex % TEAM_SUMMARY_COLORS.length],
      slots,
    }
  })
  const teamSelectPickerCandidates = teamSelectPickerSlot
    ? getAvailableMembersForSeedSlot(teamSelectPickerSlot.seedNumber, teamSelectPickerSlot.teamNumber)
    : []

  const handleConfirmTeamSelectBracket = () => {
    if (!teamDrawCardId) return
    const teamSnapshots = teamColumns
      .map((team) => {
        const members = team.slots.flatMap((slot) => {
          if (!slot.member) return []
          const riotId = slot.member.riotId
          return [
            {
              id: slot.member.application.id,
              riotId,
              discordId: slot.member.discordId,
              seedNumber: slot.seedNumber,
              sp: calculateSeedSp(riotId),
              highestTier: formatHighestTierChipText(getSignupSeasonPeakTierFromRiotId(riotId)),
              currentTier: currentTierByRiotId[riotId] ?? 'UNRANKED',
              profileIconId: typeof profileIconByRiotId[riotId] === 'number' ? profileIconByRiotId[riotId] : null,
            } satisfies TeamBracketMember,
          ]
        })
        return {
          teamNumber: team.teamNumber,
          teamSp: team.teamSp,
          color: team.color,
          members,
        } satisfies TeamBracketTeam
      })
      .filter((team) => team.members.length > 0)

    if (teamSnapshots.length < 2) {
      window.alert('대진표 생성을 위해 최소 2팀 이상 배치해주세요.')
      return
    }

    const shuffledTeams = shuffleArray(teamSnapshots)
    const groups: TeamBracketGroup[] = []
    let groupIndex = 0
    for (let startIndex = 0; startIndex < shuffledTeams.length; startIndex += 4) {
      const chunk = shuffledTeams.slice(startIndex, startIndex + 4)
      if (chunk.length === 0) continue
      const label = `${String.fromCharCode(65 + groupIndex)}조`
      const matches: TeamBracketMatch[] = [
        {
          id: `${label}-semi-1`,
          stage: 'semi',
          teamA: chunk[0] ?? null,
          teamB: chunk[1] ?? null,
          winner: null,
          tournamentCode: null,
        },
        {
          id: `${label}-semi-2`,
          stage: 'semi',
          teamA: chunk[2] ?? null,
          teamB: chunk[3] ?? null,
          winner: null,
          tournamentCode: null,
        },
        {
          id: `${label}-final`,
          stage: 'final',
          teamA: null,
          teamB: null,
          winner: null,
          tournamentCode: null,
        },
        {
          id: `${label}-lower`,
          stage: 'lower',
          teamA: null,
          teamB: null,
          winner: null,
          tournamentCode: null,
        },
      ]
      groups.push({
        id: `group-${groupIndex + 1}`,
        label,
        matches,
      })
      groupIndex += 1
    }

    const nextBracket: TeamBracket = {
      cardId: teamDrawCardId,
      createdAt: Date.now(),
      groups,
    }
    setTeamBracketByCardId((prev) => ({ ...prev, [teamDrawCardId]: nextBracket }))
    setActiveMenu(TEAM_BRACKET_MENU)
  }

  const handleSelectBracketWinner = (groupId: string, matchId: string, winner: 'A' | 'B') => {
    if (!teamDrawCardId) return
    setTeamBracketByCardId((prev) => {
      const currentBracket = prev[teamDrawCardId]
      if (!currentBracket) return prev
      const nextGroups = currentBracket.groups.map((group) => {
        if (group.id !== groupId) return group
        let targetMatch = group.matches.find((match) => match.id === matchId) ?? null
        let workingMatches = group.matches
        if (!targetMatch) {
          const stage: TeamBracketMatch['stage'] = matchId.endsWith('-final')
            ? 'final'
            : matchId.endsWith('-lower')
              ? 'lower'
              : 'semi'
          targetMatch = {
            id: matchId,
            stage,
            teamA: null,
            teamB: null,
            winner: null,
            tournamentCode: null,
          }
          workingMatches = [...group.matches, targetMatch]
        }
        if (!targetMatch) return group
        const nextWinner = targetMatch.winner === winner ? null : winner
        const shouldResetDownstream = (targetMatch.stage ?? 'semi') === 'semi'
        return {
          ...group,
          matches: workingMatches.map((match) => {
            if (match.id === matchId) {
              return {
                ...match,
                winner: nextWinner,
              }
            }
            if (shouldResetDownstream && (match.stage === 'final' || match.stage === 'lower')) {
              return {
                ...match,
                winner: null,
              }
            }
            return {
              ...match,
              winner: match.winner,
            }
          }),
        }
      })
      return {
        ...prev,
        [teamDrawCardId]: {
          ...currentBracket,
          groups: nextGroups,
        },
      }
    })
  }

  const getGroupPlacement = (group: TeamBracketGroup): BracketPlacementRecord => {
    const semifinalMatches = group.matches.filter((match) => (match.stage ?? 'semi') === 'semi').slice(0, 2)
    const finalMatch = group.matches.find((match) => match.stage === 'final') ?? null
    const lowerMatch = group.matches.find((match) => match.stage === 'lower') ?? null
    const firstSemi = semifinalMatches[0] ?? null
    const secondSemi = semifinalMatches[1] ?? null
    const getWinnerTeam = (match: TeamBracketMatch | null) => {
      if (!match) return null
      if (match.winner === 'A') return match.teamA
      if (match.winner === 'B') return match.teamB
      return null
    }
    const getLoserTeam = (match: TeamBracketMatch | null) => {
      if (!match) return null
      if (match.winner === 'A') return match.teamB
      if (match.winner === 'B') return match.teamA
      return null
    }
    const finalistA = getWinnerTeam(firstSemi)
    const finalistB = getWinnerTeam(secondSemi)
    const lowerA = getLoserTeam(firstSemi)
    const lowerB = getLoserTeam(secondSemi)
    const firstPlace = finalMatch?.winner === 'A' ? finalistA : finalMatch?.winner === 'B' ? finalistB : null
    const secondPlace = finalMatch?.winner === 'A' ? finalistB : finalMatch?.winner === 'B' ? finalistA : null
    const thirdPlace = lowerMatch?.winner === 'A' ? lowerA : lowerMatch?.winner === 'B' ? lowerB : null
    const fourthPlace = lowerMatch?.winner === 'A' ? lowerB : lowerMatch?.winner === 'B' ? lowerA : null

    return {
      firstTeamNumber: firstPlace?.teamNumber ?? null,
      secondTeamNumber: secondPlace?.teamNumber ?? null,
      thirdTeamNumber: thirdPlace?.teamNumber ?? null,
      fourthTeamNumber: fourthPlace?.teamNumber ?? null,
    }
  }

  const handleSaveTeamBracketRecord = () => {
    if (!currentTeamDrawCard || !currentTeamBracket) {
      window.alert('저장할 대진표가 없습니다.')
      return
    }
    const buildGroupRecord = (group: TeamBracketGroup) => {
      const teamsByNumber = new Map<number, Map<string, string>>()
      group.matches.forEach((match) => {
        const collect = (team: TeamBracketTeam | null) => {
          if (!team) return
          const members = teamsByNumber.get(team.teamNumber) ?? new Map<string, string>()
          team.members.forEach((member) => members.set(member.riotId, member.highestTier))
          teamsByNumber.set(team.teamNumber, members)
        }
        collect(match.teamA)
        collect(match.teamB)
      })
      const teams = [...teamsByNumber.entries()]
        .map(([teamNumber, members]) => ({
          teamNumber,
          members: [...members.entries()].map(([riotId, highestTier]) => ({ riotId, highestTier })),
        }))
        .sort((a, b) => a.teamNumber - b.teamNumber)
      const matches = group.matches.map((match) => ({
        matchId: match.id,
        stage: match.stage,
        teamANumber: match.teamA?.teamNumber ?? null,
        teamBNumber: match.teamB?.teamNumber ?? null,
        winnerTeamNumber:
          match.winner === 'A' ? match.teamA?.teamNumber ?? null : match.winner === 'B' ? match.teamB?.teamNumber ?? null : null,
        tournamentCode: match.tournamentCode,
      }))
      return {
        groupId: group.id,
        label: group.label,
        placement: getGroupPlacement(group),
        teams,
        matches,
      }
    }
    const nextRecord: InhouseBracketRecord = {
      id: `${currentTeamDrawCard.id}-${Date.now()}`,
      cardId: currentTeamDrawCard.id,
      category: currentTeamDrawCard.category,
      title: currentTeamDrawCard.title,
      startAt: currentTeamDrawCard.startAt,
      savedAt: Date.now(),
      groups: currentTeamBracket.groups.map(buildGroupRecord),
    }
    setInhouseBracketRecords((prev) => [nextRecord, ...prev.filter((record) => record.cardId !== nextRecord.cardId)])
    setRecordCategoryFilter('detail-record')
    setInhouseCards((prev) => prev.filter((card) => card.id !== currentTeamDrawCard.id))
    setInhouseApplications((prev) => prev.filter((item) => item.cardId !== currentTeamDrawCard.id))
    setTeamBracketByCardId((prev) => {
      const next = { ...prev }
      delete next[currentTeamDrawCard.id]
      return next
    })
    setTeamDrawCardId('')
    setActiveMenu('기록')
  }

  const handleIssueTournamentCode = async (
    groupId: string,
    matchId: string,
    stage: TeamBracketMatch['stage'],
    teamAName: string,
    teamBName: string,
  ) => {
    if (!currentTeamDrawCard) return
    const loadingKey = `${groupId}:${matchId}`
    if (tournamentCodeLoadingByMatchId[loadingKey]) return
    setTournamentCodeLoadingByMatchId((prev) => ({ ...prev, [loadingKey]: true }))
    try {
      const response = await fetch('/api/riot/tournament-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: currentTeamDrawCard.id,
          title: currentTeamDrawCard.title,
          startAt: currentTeamDrawCard.startAt,
          groupId,
          matchId,
          stage,
          teamAName,
          teamBName,
        }),
      })
      const data = (await response.json()) as { code?: string; error?: string }
      if (!response.ok || !data.code) {
        window.alert(data.error ?? '토너먼트 코드 발급에 실패했습니다.')
        return
      }
      setTeamBracketByCardId((prev) => {
        if (!teamDrawCardId) return prev
        const bracket = prev[teamDrawCardId]
        if (!bracket) return prev
        return {
          ...prev,
          [teamDrawCardId]: {
            ...bracket,
            groups: bracket.groups.map((group) => {
              if (group.id !== groupId) return group
              const targetMatch = group.matches.find((match) => match.id === matchId)
              const matches = targetMatch
                ? group.matches
                : [
                    ...group.matches,
                    {
                      id: matchId,
                      stage,
                      teamA: null,
                      teamB: null,
                      winner: null,
                      tournamentCode: null,
                    } satisfies TeamBracketMatch,
                  ]
              return {
                ...group,
                matches: matches.map((match) =>
                  match.id === matchId
                    ? {
                        ...match,
                        tournamentCode: data.code ?? null,
                      }
                    : match,
                ),
              }
            }),
          },
        }
      })
    } finally {
      setTournamentCodeLoadingByMatchId((prev) => {
        const next = { ...prev }
        delete next[loadingKey]
        return next
      })
    }
  }

  const formatInhouseScore = (profile: RiotProfileResponse) => {
    const score = calculateSeedSpByInputs(profile.summoner.riotId, profile.rankedSolo)
    return `${score.toFixed(1)} SP`
  }

  const getRecordErrorSummary = (rawError: string) => {
    const source = rawError.trim()
    if (!source) return '전적 조회 중 오류가 발생했습니다.'
    const lower = source.toLowerCase()
    const statusMatch = source.match(/(?:status_code|httpstatus|riot api)\D*(\d{3})/i)
    const statusCode = statusMatch ? Number(statusMatch[1]) : null

    if (lower.includes('unknown apikey') || (statusCode === 401 && lower.includes('api'))) {
      return 'Riot API 인증에 실패했습니다. 관리자에게 API 키 확인을 요청해주세요.'
    }
    if (statusCode === 404 || lower.includes('not found') || lower.includes('data not found')) {
      return '소환사 정보를 찾지 못했습니다. 소환사명과 태그를 다시 확인해주세요.'
    }
    if (statusCode === 429 || lower.includes('rate limit')) {
      return '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.'
    }
    if (statusCode === 403) {
      return '이 요청은 Riot API에서 거부되었습니다. 권한 또는 지역 설정을 확인해주세요.'
    }
    if (statusCode !== null && statusCode >= 500) {
      return 'Riot API 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    }
    return '전적 정보를 불러오지 못했습니다. 소환사명을 확인해주세요.'
  }

  const handleRecordSearch = async (sourceRiotId?: string) => {
    const riotId = (sourceRiotId ?? recordInput).trim()
    if (!riotId) return

    setRecordInput(riotId)
    setRecordLoading(true)
    setRecordError('')
    setIsRecordErrorDetailOpen(false)
    setRecordPersistedStats(null)
    try {
      const response = await fetch(`/api/riot/profile?riotId=${encodeURIComponent(riotId)}`)
      const data = await response.json()
      if (!response.ok) {
        setRecordData(null)
        setRecordError(data.error ?? '전적 조회에 실패했습니다.')
        return
      }
      const profileData = data as RiotProfileResponse
      setRecordData(profileData)
      try {
        const statsResponse = await fetch(`/api/stats/player?riotId=${encodeURIComponent(profileData.summoner.riotId)}`)
        const statsData = (await statsResponse.json()) as PersistedPlayerStats & { error?: string }
        if (statsResponse.ok) {
          setRecordPersistedStats(statsData)
        } else {
          setRecordPersistedStats(null)
        }
      } catch {
        setRecordPersistedStats(null)
      }
    } finally {
      setRecordLoading(false)
    }
  }

  const handleHomeSearchSubmit = () => {
    const riotId = homeSearchInput.trim()
    if (!riotId) return
    setActiveMenu('전적')
    setIsLoginPage(false)
    setIsUserInfoPage(false)
    setAuthMode('login')
    setAuthFeedback('')
    setPendingAccountId('')
    void handleRecordSearch(riotId)
  }

  const handleOpenRecordFromStats = (riotId: string) => {
    const target = riotId.trim()
    if (!target) return
    setActiveMenu('전적')
    setIsLoginPage(false)
    setIsUserInfoPage(false)
    setAuthMode('login')
    setAuthFeedback('')
    setPendingAccountId('')
    void handleRecordSearch(target)
  }

  const handleOpenRecordKdaRanking = () => {
    setActiveMenu('기록')
    setIsLoginPage(false)
    setIsUserInfoPage(false)
    setAuthMode('login')
    setAuthFeedback('')
    setPendingAccountId('')
  }

  const formatInhouseStartAt = (value: string) => {
    return value
  }

  const handleCreateInhouseCard = () => {
    const title = inhouseCreateTitle.trim()
    const startAt = inhouseCreateStartAt.trim()
    if (!title || !startAt) {
      setInhouseCreateFeedback('제목과 시작 시간을 모두 입력해주세요.')
      return
    }

    const nextCard: InhouseCard = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: inhouseCategory,
      title,
      startAt,
    }
    setInhouseCards((prev) => [nextCard, ...prev])
    setInhouseCreateFeedback('')
    setInhouseCreateTitle('')
    setInhouseCreateStartAt('')
    setIsInhouseCreateModalOpen(false)
  }

  const openInhouseEditModal = (card: InhouseCard) => {
    setInhouseEditTargetId(card.id)
    setInhouseEditTitle(card.title)
    setInhouseEditStartAt(card.startAt)
    setInhouseEditFeedback('')
    setIsInhouseEditModalOpen(true)
  }

  const handleSaveInhouseEdit = () => {
    const title = inhouseEditTitle.trim()
    const startAt = inhouseEditStartAt.trim()
    if (!title || !startAt) {
      setInhouseEditFeedback('제목과 시작 시간을 모두 입력해주세요.')
      return
    }

    setInhouseCards((prev) =>
      prev.map((card) =>
        card.id === inhouseEditTargetId
          ? {
              ...card,
              title,
              startAt,
            }
          : card,
      ),
    )
    setIsInhouseEditModalOpen(false)
  }

  const handleDeleteInhouseFromEdit = () => {
    const shouldDelete = window.confirm('이 내전을 삭제할까요?')
    if (!shouldDelete) return
    setInhouseCards((prev) => prev.filter((card) => card.id !== inhouseEditTargetId))
    setInhouseApplications((prev) => prev.filter((item) => item.cardId !== inhouseEditTargetId))
    setInhouseBracketRecords((prev) => prev.filter((record) => record.cardId !== inhouseEditTargetId))
    setTeamBracketByCardId((prev) => {
      if (!prev[inhouseEditTargetId]) return prev
      const next = { ...prev }
      delete next[inhouseEditTargetId]
      return next
    })
    setIsInhouseEditModalOpen(false)
  }

  const openInhouseApplyModal = (cardId: string) => {
    if (!currentUserLabel.trim()) {
      window.alert('로그인 후 신청할 수 있습니다.')
      return
    }
    setInhouseApplyTargetCardId(cardId)
    setIsInhouseApplyModalOpen(true)
  }

  const getInhouseApplyStatusForCurrentUser = (cardId: string): InhouseApplyStatus | '' => {
    const userKey = currentUserLabel.trim().toLowerCase()
    if (!userKey) return ''
    const found = inhouseApplications.find(
      (item) => item.cardId === cardId && item.userLabel.trim().toLowerCase() === userKey,
    )
    return found?.status ?? ''
  }

  const getInhouseApplicantsByStatus = (cardId: string, status: InhouseApplyStatus) => {
    return inhouseApplications.filter((item) => item.cardId === cardId && item.status === status).map((item) => item.userLabel)
  }

  const handleSelectInhouseApplyStatus = (status: InhouseApplyStatus) => {
    const cardId = inhouseApplyTargetCardId.trim()
    const userLabel = currentUserLabel.trim()
    if (!cardId || !userLabel) return
    const targetCard = inhouseCards.find((card) => card.id === cardId) ?? null
    const maxSeedMemberCount = targetCard
      ? getMaxSeedMemberCountByStartAt(targetCard.startAt)
      : DEFAULT_MAX_SEED_MEMBER_COUNT
    const userKey = userLabel.toLowerCase()
    const signupProfiles = readSignupProfiles()
    const signupProfile =
      signupProfiles.find((item) => {
        const accountKey = item.accountLabel.trim().toLowerCase()
        const riotKey = item.riotId.trim().toLowerCase()
        return accountKey === userKey || riotKey === userKey
      }) ?? null
    const adminProfile = readAdminProfile()
    const isAdminProfile = adminProfile.accountLabel.trim().toLowerCase() === userKey
    const riotId = signupProfile?.riotId ?? (isAdminProfile ? adminProfile.riotId : '-')
    const discordId = signupProfile?.discordId ?? (isAdminProfile ? adminProfile.discordId : '-')
    const currentApplication = inhouseApplications.find(
      (item) => item.cardId === cardId && item.userLabel.trim().toLowerCase() === userKey,
    )
    const isAlreadyApplied = currentApplication?.status === 'applied'
    const appliedCount = inhouseApplications.filter((item) => item.cardId === cardId && item.status === 'applied').length
    if (status === 'applied' && !isAlreadyApplied && appliedCount >= maxSeedMemberCount) {
      window.alert(`신청 인원은 최대 ${maxSeedMemberCount}명까지 가능합니다.`)
      return
    }
    setInhouseApplications((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.cardId === cardId && item.userLabel.trim().toLowerCase() === userKey,
      )
      if (existingIndex < 0) {
        return [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            cardId,
            userLabel,
            status,
            riotId,
            discordId,
          },
        ]
      }
      const next = [...prev]
      next[existingIndex] = {
        ...next[existingIndex],
        status,
        riotId,
        discordId,
      }
      return next
    })
    setIsInhouseApplyModalOpen(false)
    setInhouseApplyTargetCardId('')
  }

  const handleCancelInhouseApply = (cardId: string) => {
    const userKey = currentUserLabel.trim().toLowerCase()
    if (!userKey) return
    setInhouseApplications((prev) =>
      prev.filter((item) => !(item.cardId === cardId && item.userLabel.trim().toLowerCase() === userKey)),
    )
  }

  const handleTeamDrawMoveApplication = (applicationId: string, status: InhouseApplyStatus) => {
    setInhouseApplications((prev) =>
      prev.map((item) =>
        item.id === applicationId
          ? {
              ...item,
              status,
            }
          : item,
      ),
    )
  }

  const handleTeamDrawDeleteApplication = (applicationId: string) => {
    setInhouseApplications((prev) => prev.filter((item) => item.id !== applicationId))
  }

  const openTeamDrawPage = (cardId: string) => {
    setTeamDrawCardId(cardId)
    setActiveMenu(MEMBER_MENU)
    setIsLoginPage(false)
    setIsUserInfoPage(false)
    setAuthMode('login')
    setAuthFeedback('')
    setPendingAccountId('')
  }

  const buildFowProfileUrl = (riotId: string) => {
    const [gameName, ...tagParts] = riotId.split('#')
    const tagLine = tagParts.join('#')
    if (!gameName || !tagLine) return null
    const normalizedName = gameName.replace(/\s+/g, '')
    const slug = `${normalizedName}-${tagLine.trim()}`
    return `https://www.fow.lol/find/kr/${encodeURIComponent(slug)}`
  }

  const handleOpenFowProfile = () => {
    if (!recordData) return
    const url = buildFowProfileUrl(recordData.summoner.riotId)
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const normalizeRiotId = (value: string) => {
    return normalizeRiotIdValue(value)
  }

  const persistStatesToServer = async (states: Record<string, string>) => {
    try {
      await fetch('/api/persist/state-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ states }),
      })
    } catch {
      // ignore sync failures and keep local data
    }
  }

  const persistStateToServer = (key: string, value: unknown) => {
    const serialized = JSON.stringify(value)
    void persistStatesToServer({ [key]: serialized })
  }

  useEffect(() => {
    localStorage.setItem(MATCH_DETAIL_ID_MAP_STORAGE_KEY, JSON.stringify(matchDetailIdByKey))
    persistStateToServer(MATCH_DETAIL_ID_MAP_STORAGE_KEY, matchDetailIdByKey)
  }, [matchDetailIdByKey])

  useEffect(() => {
    if (!hasLoadedNoticeItems.current) {
      hasLoadedNoticeItems.current = true
      return
    }
    localStorage.setItem(NOTICE_ITEMS_STORAGE_KEY, JSON.stringify(noticeItems))
    persistStateToServer(NOTICE_ITEMS_STORAGE_KEY, noticeItems)
  }, [noticeItems])

  const formatSecondsToMinuteText = (totalSeconds: number) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '-'
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const getChampionIconUrl = (championName: string) => {
    const normalized = championName.trim()
    if (!normalized) return ''
    return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${encodeURIComponent(normalized)}.png`
  }

  const getItemIconUrl = (itemId: number) => {
    if (!Number.isFinite(itemId) || itemId <= 0) return ''
    return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`
  }

  const formatPerMinuteText = (value: number, totalSeconds: number) => {
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0.0'
    return (value / (totalSeconds / 60)).toFixed(1)
  }

  const formatKdaRatioText = (kills: number, deaths: number, assists: number) => {
    if (deaths === 0) return 'Perfect'
    return `${((kills + assists) / deaths).toFixed(2)}:1`
  }

  const getKdaTierClass = (kdaValue: number | null | undefined) => {
    if (typeof kdaValue !== 'number' || !Number.isFinite(kdaValue)) return ''
    if (kdaValue >= 4) return 'kda-tier-4'
    if (kdaValue >= 3) return 'kda-tier-3'
    if (kdaValue >= 2) return 'kda-tier-2'
    return 'kda-tier-1'
  }

  const normalizeMatchId = (value: string) => value.replace(/\s+/g, '').trim()
  const formatMatchupTitle = (groupLabel: string, teamANumber: number | null, teamBNumber: number | null) =>
    `${groupLabel} ${teamANumber ? `${teamANumber}팀` : '대기'} vs ${teamBNumber ? `${teamBNumber}팀` : '대기'}`

  const openMatchResultInputModal = (matchKey: string, title: string) => {
    if (!isAdminSession) {
      window.alert('결과입력은 관리자만 가능합니다.')
      return
    }
    setMatchDetailModalMode('input')
    setMatchDetailTargetKey(matchKey)
    setIsMatchDetailModalOpen(true)
    setMatchDetailInput(matchDetailIdByKey[matchKey] ?? '')
    setMatchDetailTitle(title)
    setMatchDetailError('')
    setMatchDetailData(null)
  }

  const openMatchResultViewModal = (matchKey: string, title: string) => {
    const savedMatchId = normalizeMatchId(matchDetailIdByKey[matchKey] ?? '')
    if (!savedMatchId) {
      window.alert('먼저 결과입력에서 매치 아이디를 등록해주세요.')
      return
    }
    setMatchDetailModalMode('view')
    setMatchDetailTargetKey(matchKey)
    setIsMatchDetailModalOpen(true)
    setMatchDetailInput(savedMatchId)
    setMatchDetailTitle(title)
    setMatchDetailError('')
    setMatchDetailData(null)
    void handleFetchMatchDetail(savedMatchId)
  }

  const handleSaveMatchDetailId = async () => {
    const targetKey = matchDetailTargetKey.trim()
    const matchId = normalizeMatchId(matchDetailInput)
    if (!targetKey) return
    if (!matchId) {
      setMatchDetailError('매치 아이디를 입력해주세요.')
      return
    }
    setMatchDetailLoading(true)
    setMatchDetailError('')
    try {
      const response = await fetch('/api/riot/save-match-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ matchId }),
      })
      const data = (await response.json()) as { error?: string; savedCount?: number }
      if (!response.ok) {
        setMatchDetailError(data.error ?? '매치 통계 저장에 실패했습니다.')
        return
      }
      setMatchDetailIdByKey((prev) => ({ ...prev, [targetKey]: matchId }))
      setIsMatchDetailModalOpen(false)
      window.alert(`매치 통계를 DB에 저장했습니다. (${data.savedCount ?? 0}명)`)
    } catch {
      setMatchDetailError('매치 통계 저장 중 오류가 발생했습니다.')
    } finally {
      setMatchDetailLoading(false)
    }
  }

  const handleFetchMatchDetail = async (matchIdSource?: string) => {
    const matchId = normalizeMatchId(matchIdSource ?? matchDetailInput)
    if (!matchId) {
      setMatchDetailError('매치 아이디를 입력해주세요.')
      return
    }
    setMatchDetailLoading(true)
    setMatchDetailError('')
    try {
      const response = await fetch(`/api/riot/match-detail?matchId=${encodeURIComponent(matchId)}`)
      const data = (await response.json()) as RiotMatchDetailResponse & { error?: string }
      if (!response.ok) {
        setMatchDetailError(data.error ?? '매치 조회에 실패했습니다.')
        setMatchDetailData(null)
        return
      }
      setMatchDetailInput(matchId)
      setMatchDetailData(data)
    } catch {
      setMatchDetailError('매치 조회 중 오류가 발생했습니다.')
      setMatchDetailData(null)
    } finally {
      setMatchDetailLoading(false)
    }
  }

  function readSignupProfiles(): SignupProfile[] {
    try {
      const raw = localStorage.getItem(SIGNUP_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const record = item as Record<string, unknown>
        if (typeof record.riotId !== 'string') {
          return []
        }
        const riotId = record.riotId.trim()
        if (!riotId) return []
        const discordId =
          typeof record.discordId === 'string' && record.discordId.trim() !== ''
            ? record.discordId
            : '-'
        const accountLabel =
          typeof record.accountLabel === 'string' && record.accountLabel.trim() !== ''
            ? record.accountLabel
            : riotId
        const password = typeof record.password === 'string' ? record.password : ''
        const seasonPeakTier =
          typeof record.seasonPeakTier === 'string' && record.seasonPeakTier.trim() !== ''
            ? record.seasonPeakTier
            : '-'
        const mainLine = typeof record.mainLine === 'string' ? record.mainLine : ''

        return [
          {
            accountLabel,
            discordId,
            riotId,
            password,
            seasonPeakTier,
            mainLine,
            userType: record.userType === '운영진' ? '운영진' : '일반',
            approvalStatus:
              record.approvalStatus === 'approved' || record.approvalStatus === 'pending'
                ? record.approvalStatus
                : 'approved',
          } satisfies SignupProfile,
        ]
      })
    } catch {
      return []
    }
  }

  function readAdminProfile(): AdminProfile {
    const fallback: AdminProfile = {
      accountLabel: 'admin#ADMIN',
      discordId: '-',
      riotId: 'admin#ADMIN',
      seasonPeakTier: '-',
      mainLine: '',
    }
    try {
      const raw = localStorage.getItem(ADMIN_PROFILE_STORAGE_KEY)
      if (!raw) return fallback
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return fallback
      const record = parsed as Record<string, unknown>
      return {
        accountLabel:
          typeof record.accountLabel === 'string' && record.accountLabel.trim() !== ''
            ? record.accountLabel
            : fallback.accountLabel,
        discordId: typeof record.discordId === 'string' ? record.discordId : fallback.discordId,
        riotId: typeof record.riotId === 'string' ? record.riotId : fallback.riotId,
        seasonPeakTier:
          typeof record.seasonPeakTier === 'string' ? record.seasonPeakTier : fallback.seasonPeakTier,
        mainLine: typeof record.mainLine === 'string' ? record.mainLine : fallback.mainLine,
      }
    } catch {
      return fallback
    }
  }

  const handleLoginSubmit = () => {
    const rawLoginId = loginId.trim()
    const loginKey = rawLoginId.toLowerCase()
    const loginPasswordValue = loginPassword.trim()
    if (!loginKey) {
      setAuthFeedbackType('error')
      setAuthFeedback('아이디를 입력해주세요.')
      return
    }

    if (loginKey === ADMIN_ACCOUNT.id.toLowerCase()) {
      if (!loginPasswordValue) {
        setAuthFeedbackType('error')
        setAuthFeedback('비밀번호를 입력해주세요.')
        return
      }
      if (loginPasswordValue !== ADMIN_ACCOUNT.password) {
        setAuthFeedbackType('error')
        setAuthFeedback('비밀번호가 올바르지 않습니다.')
        return
      }
      const adminProfile = readAdminProfile()
      const session: AuthSession = {
        userLabel: adminProfile.accountLabel,
        isAdmin: true,
      }
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
      setAuthFeedbackType('success')
      setAuthFeedback('운영자 로그인되었습니다.')
      setActiveMenu('홈')
      setIsLoginPage(false)
      setIsUserInfoPage(false)
      setAuthMode('login')
      setPendingAccountId('')
      setCurrentUserLabel(adminProfile.accountLabel)
      setIsAdminSession(true)
      return
    }

    const normalizedLoginRiotId = normalizeRiotId(rawLoginId)
    if (!normalizedLoginRiotId) {
      setAuthFeedbackType('error')
      setAuthFeedback('로그인 아이디는 롤 아이디#태그 형식으로 입력해주세요.')
      return
    }

    const profiles = readSignupProfiles()
    const profile = profiles.find((item) => normalizeRiotId(item.riotId) === normalizedLoginRiotId)
    if (!profile) {
      setAuthFeedbackType('error')
      setAuthFeedback('가입된 계정을 찾을 수 없습니다.')
      return
    }
    if (profile.password) {
      if (!loginPasswordValue) {
        setAuthFeedbackType('error')
        setAuthFeedback('비밀번호를 입력해주세요.')
        return
      }
      if (profile.password !== loginPasswordValue) {
        setAuthFeedbackType('error')
        setAuthFeedback('비밀번호가 올바르지 않습니다.')
        return
      }
    }

    if (profile.approvalStatus !== 'approved') {
      setPendingAccountId(profile.riotId)
      setAuthMode('pending')
      setAuthFeedback('')
      return
    }

    setAuthFeedbackType('success')
    setAuthFeedback('로그인되었습니다.')
    const canManage = profile.userType === '운영진'
    const session: AuthSession = {
      userLabel: profile.accountLabel || profile.riotId,
      isAdmin: canManage,
    }
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
    setActiveMenu('홈')
    setIsLoginPage(false)
    setIsUserInfoPage(false)
    setAuthMode('login')
    setPendingAccountId('')
    setCurrentUserLabel(profile.accountLabel || profile.riotId)
    setIsAdminSession(canManage)
  }

  const handleSignupSubmit = () => {
    const discordId = signupDiscordId.trim()
    const riotId = signupRiotId.trim()
    const password = signupPassword.trim()
    const passwordConfirm = signupPasswordConfirm.trim()
    const season = signupSeason.trim()
    const tier = signupTier.trim()
    const lp = signupLp.trim()
    const tierOption = findTierOption(tier)
    const seasonPeakTier = buildSeasonPeakTier(season, tier, lp)
    const mainLine = signupMainLine.trim()

    if (!discordId || !riotId || !password || !passwordConfirm || !seasonPeakTier || !mainLine) {
      setAuthFeedbackType('error')
      setAuthFeedback('회원가입 항목을 모두 입력해주세요.')
      return
    }
    if (password !== passwordConfirm) {
      setAuthFeedbackType('error')
      setAuthFeedback('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!tierOption) {
      setAuthFeedbackType('error')
      setAuthFeedback('티어를 선택해주세요.')
      return
    }
    if (tierOption.requiresLp) {
      if (!lp) {
        setAuthFeedbackType('error')
        setAuthFeedback('마스터 이상은 LP를 입력해주세요.')
        return
      }
      if (!/^\d+$/.test(lp)) {
        setAuthFeedbackType('error')
        setAuthFeedback('LP는 숫자만 입력해주세요.')
        return
      }
    }

    const normalizedRiotId = normalizeRiotId(riotId)
    if (!normalizedRiotId) {
      setAuthFeedbackType('error')
      setAuthFeedback('롤 아이디는 아이디#태그 형식으로 입력해주세요.')
      return
    }

    const profiles = readSignupProfiles()
    const isDuplicated = profiles.some(
      (profile) => normalizeRiotId(profile.riotId) === normalizedRiotId,
    )
    if (isDuplicated) {
      setAuthFeedbackType('error')
      setAuthFeedback('이미 가입된 롤 아이디#태그입니다.')
      return
    }

    const nextProfiles = [
      ...profiles,
      {
        accountLabel: riotId,
        discordId,
        riotId,
        password,
        seasonPeakTier,
        mainLine,
        userType: '일반',
        approvalStatus: 'pending',
      },
    ]
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(nextProfiles))
    persistStateToServer(SIGNUP_STORAGE_KEY, nextProfiles)
    setUsersVersion((value) => value + 1)

    setAuthFeedbackType('success')
    setAuthFeedback('회원가입이 완료되었습니다. 운영자 승인 후 로그인 가능합니다.')
    setSignupDiscordId('')
    setSignupRiotId('')
    setSignupPassword('')
    setSignupPasswordConfirm('')
    setSignupSeason('')
    setSignupTier('')
    setSignupLp('')
    setSignupMainLine('')
    setAuthMode('login')
  }

  function getSignupProfileByRiotId(riotId: string) {
    const target = normalizeRiotIdValue(riotId)
    if (!target) return null
    const profiles = readSignupProfiles()
    return profiles.find((item) => normalizeRiotIdValue(item.riotId) === target) ?? null
  }

  function getSignupSeasonPeakTierFromRiotId(riotId: string) {
    const profile = getSignupProfileByRiotId(riotId)
    if (profile?.seasonPeakTier?.trim()) return profile.seasonPeakTier.trim()
    const adminProfile = readAdminProfile()
    return normalizeRiotIdValue(adminProfile.riotId) === normalizeRiotIdValue(riotId)
      ? adminProfile.seasonPeakTier?.trim() || '-'
      : '-'
  }

  function getSignupDiscordIdFromRiotId(riotId: string) {
    const profile = getSignupProfileByRiotId(riotId)
    return profile?.discordId?.trim() || '-'
  }

  function getSignupMainLineFromRiotId(riotId: string) {
    const profile = getSignupProfileByRiotId(riotId)
    if (profile?.mainLine?.trim()) return profile.mainLine.trim().toUpperCase()
    const adminProfile = readAdminProfile()
    return normalizeRiotIdValue(adminProfile.riotId) === normalizeRiotIdValue(riotId)
      ? adminProfile.mainLine?.trim().toUpperCase() || '-'
      : '-'
  }

  const getSignupProfileByUserLabel = (userLabel: string) => {
    const key = userLabel.trim().toLowerCase()
    if (!key) return null
    const profiles = readSignupProfiles()
    return (
      profiles.find((item) => {
        const accountKey = (item.accountLabel || item.riotId).trim().toLowerCase()
        return accountKey === key
      }) ?? null
    )
  }

  const openUserInfoPage = () => {
    if (isAdminSession) {
      const adminProfile = readAdminProfile()
      const parsedSeasonPeakTier = parseSeasonPeakTier(adminProfile.seasonPeakTier)
      setUserInfoAccount(adminProfile.accountLabel)
      setUserInfoDiscord(adminProfile.discordId)
      setUserInfoRiotId(adminProfile.riotId)
      setUserInfoSeason(parsedSeasonPeakTier.season)
      setUserInfoTier(parsedSeasonPeakTier.tier)
      setUserInfoLp(parsedSeasonPeakTier.lp)
      setUserInfoMainLine(adminProfile.mainLine)
      setUserInfoApprovalStatus('approved')
    } else {
      const profile = getSignupProfileByUserLabel(currentUserLabel)
      const parsedSeasonPeakTier = parseSeasonPeakTier(profile?.seasonPeakTier ?? '')
      setUserInfoAccount(profile?.accountLabel ?? currentUserLabel)
      setUserInfoDiscord(profile?.discordId ?? '')
      setUserInfoRiotId(profile?.riotId ?? currentUserLabel)
      setUserInfoSeason(parsedSeasonPeakTier.season)
      setUserInfoTier(parsedSeasonPeakTier.tier)
      setUserInfoLp(parsedSeasonPeakTier.lp)
      setUserInfoMainLine(profile?.mainLine ?? '')
      setUserInfoApprovalStatus(profile?.approvalStatus ?? 'pending')
    }
    setUserInfoFeedback('')
    setIsLoginPage(false)
    setIsUserInfoPage(true)
  }

  const handleSaveUserInfo = () => {
    const season = userInfoSeason.trim()
    const tier = userInfoTier.trim()
    const lp = userInfoLp.trim()
    const tierOption = findTierOption(tier)
    const seasonPeakTier = buildSeasonPeakTier(season, tier, lp)

    if (isAdminSession) {
      const nextProfile: AdminProfile = {
        accountLabel: userInfoAccount.trim() || 'admin#ADMIN',
        discordId: userInfoDiscord.trim() || '-',
        riotId: userInfoRiotId.trim() || 'admin#ADMIN',
        seasonPeakTier: seasonPeakTier || '-',
        mainLine: userInfoMainLine.trim(),
      }
      localStorage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile))
      persistStateToServer(ADMIN_PROFILE_STORAGE_KEY, nextProfile)
      const session: AuthSession = {
        userLabel: nextProfile.accountLabel,
        isAdmin: true,
      }
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
      setCurrentUserLabel(nextProfile.accountLabel)
      setUserInfoFeedbackType('success')
      setUserInfoFeedback('정보가 저장되었습니다.')
      setIsUserInfoPage(false)
      setIsLoginPage(false)
      setActiveMenu('홈')
      return
    }

    const accountLabel = userInfoAccount.trim()
    const discordId = userInfoDiscord.trim()
    const riotId = userInfoRiotId.trim()
    const mainLine = userInfoMainLine.trim()
    if (!accountLabel || !discordId || !riotId || !seasonPeakTier || !mainLine) {
      setUserInfoFeedbackType('error')
      setUserInfoFeedback('모든 항목을 입력해주세요.')
      return
    }
    if (!tierOption) {
      setUserInfoFeedbackType('error')
      setUserInfoFeedback('티어를 선택해주세요.')
      return
    }
    if (tierOption.requiresLp) {
      if (!lp) {
        setUserInfoFeedbackType('error')
        setUserInfoFeedback('마스터 이상은 LP를 입력해주세요.')
        return
      }
      if (!/^\d+$/.test(lp)) {
        setUserInfoFeedbackType('error')
        setUserInfoFeedback('LP는 숫자만 입력해주세요.')
        return
      }
    }

    const normalizedNewRiotId = normalizeRiotId(riotId)
    if (!normalizedNewRiotId) {
      setUserInfoFeedbackType('error')
      setUserInfoFeedback('롤 아이디는 아이디#태그 형식으로 입력해주세요.')
      return
    }

    const profiles = readSignupProfiles()
    const currentProfileIndex = profiles.findIndex(
      (item) => (item.accountLabel || item.riotId).trim().toLowerCase() === currentUserLabel.trim().toLowerCase(),
    )
    if (currentProfileIndex < 0) {
      setUserInfoFeedbackType('error')
      setUserInfoFeedback('현재 계정을 찾을 수 없습니다.')
      return
    }

    const duplicatedRiotId = profiles.some((item, index) => {
      if (index === currentProfileIndex) return false
      return normalizeRiotId(item.riotId) === normalizedNewRiotId
    })
    if (duplicatedRiotId) {
      setUserInfoFeedbackType('error')
      setUserInfoFeedback('이미 사용 중인 롤 아이디#태그입니다.')
      return
    }

    const nextProfiles = [...profiles]
    nextProfiles[currentProfileIndex] = {
      ...nextProfiles[currentProfileIndex],
      accountLabel,
      discordId,
      riotId,
      seasonPeakTier,
      mainLine,
    }
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(nextProfiles))
    persistStateToServer(SIGNUP_STORAGE_KEY, nextProfiles)
    setUsersVersion((value) => value + 1)

    const canManage = nextProfiles[currentProfileIndex]?.userType === '운영진'
    const session: AuthSession = {
      userLabel: accountLabel,
      isAdmin: canManage,
    }
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
    setCurrentUserLabel(accountLabel)
    setIsAdminSession(canManage)
    setUserInfoFeedbackType('success')
    setUserInfoFeedback('정보가 저장되었습니다.')
    setIsUserInfoPage(false)
    setIsLoginPage(false)
    setActiveMenu('홈')
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    setCurrentUserLabel('')
    setIsUserInfoPage(false)
    setIsLoginPage(true)
    setAuthMode('login')
    setAuthFeedback('')
    setPendingAccountId('')
    setLoginId('')
    setLoginPassword('')
    setIsAdminSession(false)
    setActiveMenu('홈')
  }

  const handleUpdateUserApproval = (riotId: string, status: 'pending' | 'approved') => {
    const target = normalizeRiotId(riotId)
    if (!target) return
    const profiles = readSignupProfiles()
    const nextProfiles = profiles.map((profile) => {
      if (normalizeRiotId(profile.riotId) !== target) return profile
      return {
        ...profile,
        approvalStatus: status,
      }
    })
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(nextProfiles))
    persistStateToServer(SIGNUP_STORAGE_KEY, nextProfiles)
    setUsersVersion((value) => value + 1)
  }

  const handleDeleteUser = (riotId: string) => {
    const target = normalizeRiotId(riotId)
    if (!target) return
    const profiles = readSignupProfiles()
    const nextProfiles = profiles.filter((profile) => normalizeRiotId(profile.riotId) !== target)
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(nextProfiles))
    persistStateToServer(SIGNUP_STORAGE_KEY, nextProfiles)
    setUsersVersion((value) => value + 1)
  }

  const openAdminEditModal = (targetProfile: SignupProfile) => {
    const parsedSeasonPeakTier = parseSeasonPeakTier(targetProfile.seasonPeakTier)
    setEditTargetRiotId(targetProfile.riotId)
    setEditAccountLabel(targetProfile.accountLabel)
    setEditDiscordId(targetProfile.discordId)
    setEditRiotId(targetProfile.riotId)
    setEditSeason(parsedSeasonPeakTier.season)
    setEditTier(parsedSeasonPeakTier.tier)
    setEditLp(parsedSeasonPeakTier.lp)
    setEditMainLine(targetProfile.mainLine)
    setEditUserType(targetProfile.userType)
    setEditApprovalStatus(targetProfile.approvalStatus)
    setEditFeedback('')
    setIsEditModalOpen(true)
  }

  const handleSaveAdminEdit = () => {
    const nextAccountLabel = editAccountLabel.trim()
    const nextDiscordId = editDiscordId.trim()
    const nextRiotId = editRiotId.trim()
    const nextSeason = editSeason.trim()
    const nextTier = editTier.trim()
    const nextLp = editLp.trim()
    const nextTierOption = findTierOption(nextTier)
    const nextSeasonPeakTier = buildSeasonPeakTier(nextSeason, nextTier, nextLp)
    const nextMainLine = editMainLine.trim().toUpperCase()

    if (!nextAccountLabel || !nextDiscordId || !nextRiotId || !nextSeasonPeakTier || !nextMainLine) {
      setEditFeedbackType('error')
      setEditFeedback('모든 항목을 입력해주세요.')
      return
    }

    if (!['TOP', 'JUNGLE', 'MID', 'ADC', 'SUP'].includes(nextMainLine)) {
      setEditFeedbackType('error')
      setEditFeedback('주라인은 TOP/JUNGLE/MID/ADC/SUP 중 하나로 선택해주세요.')
      return
    }
    if (!nextTierOption) {
      setEditFeedbackType('error')
      setEditFeedback('티어를 선택해주세요.')
      return
    }
    if (nextTierOption.requiresLp) {
      if (!nextLp) {
        setEditFeedbackType('error')
        setEditFeedback('마스터 이상은 LP를 입력해주세요.')
        return
      }
      if (!/^\d+$/.test(nextLp)) {
        setEditFeedbackType('error')
        setEditFeedback('LP는 숫자만 입력해주세요.')
        return
      }
    }

    const normalizedNextRiotId = normalizeRiotId(nextRiotId)
    if (!normalizedNextRiotId) {
      setEditFeedbackType('error')
      setEditFeedback('롤 아이디는 아이디#태그 형식으로 입력해주세요.')
      return
    }

    const profiles = readSignupProfiles()
    const currentIndex = profiles.findIndex(
      (profile) => normalizeRiotId(profile.riotId) === normalizeRiotId(editTargetRiotId),
    )
    if (currentIndex < 0) return

    const duplicatedRiotId = profiles.some((profile, index) => {
      if (index === currentIndex) return false
      return normalizeRiotId(profile.riotId) === normalizedNextRiotId
    })
    if (duplicatedRiotId) {
      setEditFeedbackType('error')
      setEditFeedback('이미 사용 중인 롤 아이디#태그입니다.')
      return
    }

    const nextProfiles = [...profiles]
    nextProfiles[currentIndex] = {
      ...nextProfiles[currentIndex],
      accountLabel: nextAccountLabel,
      discordId: nextDiscordId,
      riotId: nextRiotId,
      seasonPeakTier: nextSeasonPeakTier,
      mainLine: nextMainLine,
      userType: editUserType,
    }
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(nextProfiles))
    persistStateToServer(SIGNUP_STORAGE_KEY, nextProfiles)
    setUsersVersion((value) => value + 1)
    setEditFeedbackType('success')
    setEditFeedback('저장되었습니다.')
    setIsEditModalOpen(false)
  }

  const managedProfiles = isAdminSession ? readSignupProfiles() : []
  const adminProfileData = readAdminProfile()
  const approvedProfiles = managedProfiles.filter((profile) => profile.approvalStatus === 'approved')
  const sortedApprovedProfiles = [...approvedProfiles].sort((left, right) => {
    const leftRank = left.userType === '운영진' ? 0 : 1
    const rightRank = right.userType === '운영진' ? 0 : 1
    if (leftRank !== rightRank) return leftRank - rightRank

    return left.accountLabel.localeCompare(right.accountLabel, 'ko-KR', { sensitivity: 'base' })
  })
  const pendingProfiles = managedProfiles.filter((profile) => profile.approvalStatus === 'pending')
  const adminCount = 1
  const staffCount = approvedProfiles.filter((profile) => profile.userType === '운영진').length
  const normalCount = approvedProfiles.filter((profile) => profile.userType === '일반').length
  const totalManagedCount = adminCount + approvedProfiles.length
  const userTypeCounts: Record<'전체' | '관리자' | '운영진' | '일반', number> = {
    전체: totalManagedCount,
    관리자: adminCount,
    운영진: staffCount,
    일반: normalCount,
  }
  const filteredApprovedProfiles =
    userTypeFilter === '전체'
      ? sortedApprovedProfiles
      : userTypeFilter === '운영진'
        ? sortedApprovedProfiles.filter((profile) => profile.userType === '운영진')
        : userTypeFilter === '일반'
          ? sortedApprovedProfiles.filter((profile) => profile.userType === '일반')
          : []
  const shouldShowAdminCard = userTypeFilter === '전체' || userTypeFilter === '관리자'

  useEffect(() => {
    if (
      !isAdminSession ||
      (activeMenu !== '관리' &&
        activeMenu !== MEMBER_MENU &&
        activeMenu !== TEAM_DRAW_MENU &&
        activeMenu !== TEAM_SELECT_MENU &&
        activeMenu !== TEAM_BRACKET_MENU)
    )
      return
    const riotIds =
      activeMenu === '관리'
        ? managedProfiles.map((profile) => profile.riotId.trim()).filter((value) => value !== '')
        : teamDrawMembers.map((item) => item.riotId.trim()).filter((value) => value !== '' && value !== '-')
    if (riotIds.length === 0) return

    const missingIds = riotIds.filter(
      (riotId) =>
        profileIconByRiotId[riotId] === undefined ||
        currentTierByRiotId[riotId] === undefined ||
        rankedSoloByRiotId[riotId] === undefined,
    )
    if (missingIds.length === 0) return

    missingIds.forEach((riotId) => {
      void fetch(`/api/riot/profile?riotId=${encodeURIComponent(riotId)}`)
        .then(async (response) => {
          if (!response.ok) {
            setProfileIconByRiotId((prev) => ({ ...prev, [riotId]: null }))
            setCurrentTierByRiotId((prev) => ({ ...prev, [riotId]: '-' }))
            setRankedSoloByRiotId((prev) => ({ ...prev, [riotId]: null }))
            return
          }
          const data = (await response.json()) as RiotProfileResponse
          setProfileIconByRiotId((prev) => ({
            ...prev,
            [riotId]: typeof data.summoner?.profileIconId === 'number' ? data.summoner.profileIconId : null,
          }))
          setCurrentTierByRiotId((prev) => ({
            ...prev,
            [riotId]: formatCurrentTierText(data.rankedSolo),
          }))
          setRankedSoloByRiotId((prev) => ({ ...prev, [riotId]: data.rankedSolo ?? null }))
        })
        .catch(() => {
          setProfileIconByRiotId((prev) => ({ ...prev, [riotId]: null }))
          setCurrentTierByRiotId((prev) => ({ ...prev, [riotId]: '-' }))
          setRankedSoloByRiotId((prev) => ({ ...prev, [riotId]: null }))
        })
    })
  }, [
    activeMenu,
    isAdminSession,
    managedProfiles,
    profileIconByRiotId,
    currentTierByRiotId,
    rankedSoloByRiotId,
    teamDrawMembers,
    MEMBER_MENU,
    TEAM_DRAW_MENU,
    TEAM_SELECT_MENU,
    TEAM_BRACKET_MENU,
  ])

  const sortedNoticeItems = [...noticeItems].sort((a, b) => b.createdAt - a.createdAt)
  const selectedNotice =
    sortedNoticeItems.find((item) => item.id === selectedNoticeId) ??
    sortedNoticeItems[0] ??
    null

  const formatNoticeDate = (timestamp: number) => {
    if (!Number.isFinite(timestamp)) return '-'
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const openNoticeModal = () => {
    setIsNoticeModalOpen(true)
    setSelectedNoticeId((prev) => prev || sortedNoticeItems[0]?.id || '')
    setNoticeFeedback('')
  }

  const handleCreateNotice = () => {
    if (!isAdminSession) return
    const title = noticeTitleInput.trim()
    const content = noticeContentInput.trim()
    if (!title || !content) {
      setNoticeFeedback('제목과 내용을 입력해주세요.')
      return
    }
    const newNotice: NoticeItem = {
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      content,
      createdAt: Date.now(),
      authorLabel: currentUserLabel.trim() || '관리자',
    }
    setNoticeItems((prev) => [newNotice, ...prev])
    setSelectedNoticeId(newNotice.id)
    setNoticeTitleInput('')
    setNoticeContentInput('')
    setNoticeFeedback('공지사항이 등록되었습니다.')
  }

  const handleDeleteNotice = (noticeId: string) => {
    if (!isAdminSession) return
    if (!window.confirm('이 공지사항을 삭제할까요?')) return
    setNoticeItems((prev) => prev.filter((item) => item.id !== noticeId))
    setSelectedNoticeId((prev) => (prev === noticeId ? '' : prev))
    setNoticeFeedback('공지사항이 삭제되었습니다.')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          {!isLoginPage && !isUserInfoPage && currentUserLabel.trim() && (
            <button type="button" className="notice-open-button" onClick={openNoticeModal} aria-label="공지사항 열기">
              <span aria-hidden="true">📢</span>
            </button>
          )}
          <button
            className="brand-button"
            type="button"
            onClick={() => {
              setActiveMenu('홈')
              setIsLoginPage(!currentUserLabel.trim())
              setIsUserInfoPage(false)
              setAuthMode('login')
              setAuthFeedback('')
              setPendingAccountId('')
            }}
          >
            LEAGUE
          </button>
          <nav className="topbar-nav" aria-label="주요 메뉴">
            {visibleMenus.map((menu) => (
              <button
                key={menu}
                type="button"
                className={activeMenu === menu ? 'is-active' : ''}
                onClick={() => {
                  setActiveMenu(menu)
                  setIsLoginPage(!currentUserLabel.trim())
                  setIsUserInfoPage(false)
                  setAuthMode('login')
                  setAuthFeedback('')
                  setPendingAccountId('')
                }}
              >
                {menu}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-right">
          <button
            className="auth-button"
            type="button"
            onClick={() => {
              if (currentUserLabel) {
                if (isUserInfoPage) {
                  setIsUserInfoPage(false)
                } else {
                  openUserInfoPage()
                }
              } else {
                setIsLoginPage(true)
                setIsUserInfoPage(false)
                setAuthMode('login')
                setAuthFeedback('')
                setPendingAccountId('')
              }
            }}
          >
            {isLoginPage || isUserInfoPage ? '돌아가기' : currentUserLabel || '로그인'}
          </button>
        </div>
      </header>

      <main className="page-body">
        {isUserInfoPage && (
          <section className="login-page">
            <article className="login-card">
              <header className="login-header">
                <h2>내 정보</h2>
              </header>
              <div className="user-info-list">
                <p>
                  <strong>계정</strong>
                  <input
                    value={userInfoAccount}
                    onChange={(event) => setUserInfoAccount(event.target.value)}
                    className="user-info-input"
                  />
                </p>
                <p>
                  <strong>디스코드</strong>
                  <input
                    value={userInfoDiscord}
                    onChange={(event) => setUserInfoDiscord(event.target.value)}
                    className="user-info-input"
                  />
                </p>
                <p>
                  <strong>롤 아이디#태그</strong>
                  <input
                    value={userInfoRiotId}
                    onChange={(event) => setUserInfoRiotId(event.target.value)}
                    className="user-info-input"
                  />
                </p>
                <p>
                  <strong>시즌-최고티어</strong>
                  <div className="tier-field-row">
                    <select
                      value={userInfoSeason}
                      onChange={(event) => setUserInfoSeason(event.target.value)}
                      className="user-info-select"
                    >
                      <option value="">시즌 선택</option>
                      {SEASON_OPTIONS.map((season) => (
                        <option key={season} value={season}>
                          {season}
                        </option>
                      ))}
                    </select>
                    <select
                      value={userInfoTier}
                      onChange={(event) => setUserInfoTier(event.target.value)}
                      className="user-info-select"
                    >
                      <option value="">티어 선택</option>
                      {TIER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </p>
                {findTierOption(userInfoTier)?.requiresLp && (
                  <p>
                    <strong>LP</strong>
                    <input
                      value={userInfoLp}
                      onChange={(event) => setUserInfoLp(event.target.value.replace(/\D/g, ''))}
                      className="user-info-input"
                      inputMode="numeric"
                      placeholder="LP 입력"
                    />
                  </p>
                )}
                <p>
                  <strong>주라인</strong>
                  <select
                    value={userInfoMainLine}
                    onChange={(event) => setUserInfoMainLine(event.target.value)}
                    className="user-info-select"
                  >
                    <option value="">선택</option>
                    <option value="TOP">TOP</option>
                    <option value="JUNGLE">JUNGLE</option>
                    <option value="MID">MID</option>
                    <option value="ADC">ADC</option>
                    <option value="SUP">SUP</option>
                  </select>
                </p>
                <p>
                  <strong>승인상태</strong>
                  <span className="user-info-value">
                    {isAdminSession
                      ? '관리자'
                      : userInfoApprovalStatus === 'approved'
                        ? '승인완료'
                        : '승인대기'}
                  </span>
                </p>
              </div>
              {userInfoFeedback && (
                <p
                  className={userInfoFeedbackType === 'error' ? 'auth-feedback is-error' : 'auth-feedback is-success'}
                >
                  {userInfoFeedback}
                </p>
              )}
              <div className="user-info-actions">
                <button type="button" className="login-submit-button" onClick={handleSaveUserInfo}>
                  저장
                </button>
                <button type="button" className="signup-button" onClick={handleLogout}>
                  로그아웃
                </button>
              </div>
            </article>
          </section>
        )}

        {isLoginPage && (
          <section className="login-page">
            <article className="login-card">
              <header className="login-header">
                <h2>{authMode === 'login' ? '로그인' : '회원가입'}</h2>
              </header>

              {authMode === 'login' && (
                <>
                  <div className="login-field-group">
                    <label htmlFor="login-id">아이디(롤 아이디#태그)</label>
                    <input
                      id="login-id"
                      value={loginId}
                      onChange={(event) => setLoginId(event.target.value)}
                      className="login-input"
                      placeholder="예: Faker#KR1"
                    />
                  </div>
                  <div className="login-field-group">
                    <label htmlFor="login-password">비밀번호</label>
                    <input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      className="login-input"
                      placeholder="비밀번호를 입력하세요"
                    />
                  </div>
                  <div className="login-actions">
                    <button type="button" className="login-submit-button" onClick={handleLoginSubmit}>
                      로그인
                    </button>
                    <button
                      type="button"
                      className="signup-button"
                      onClick={() => {
                        setAuthMode('signup')
                        setAuthFeedback('')
                      }}
                    >
                      회원가입
                    </button>
                  </div>
                </>
              )}

              {authMode === 'signup' && (
                <>
                  <div className="login-field-group">
                    <label htmlFor="signup-discord-id">디스코드</label>
                    <input
                      id="signup-discord-id"
                      value={signupDiscordId}
                      onChange={(event) => setSignupDiscordId(event.target.value)}
                      className="login-input"
                      placeholder="예: Faker"
                    />
                  </div>
                  <div className="login-field-group">
                    <label htmlFor="signup-riot-id">롤 아이디#태그</label>
                    <input
                      id="signup-riot-id"
                      value={signupRiotId}
                      onChange={(event) => setSignupRiotId(event.target.value)}
                      className="login-input"
                      placeholder="예: Faker#KR1"
                    />
                  </div>
                  <div className="login-field-group">
                    <label htmlFor="signup-password">비밀번호</label>
                    <input
                      id="signup-password"
                      type="password"
                      value={signupPassword}
                      onChange={(event) => setSignupPassword(event.target.value)}
                      className="login-input"
                      placeholder="비밀번호를 입력하세요"
                    />
                  </div>
                  <div className="login-field-group">
                    <label htmlFor="signup-password-confirm">비밀번호 확인</label>
                    <input
                      id="signup-password-confirm"
                      type="password"
                      value={signupPasswordConfirm}
                      onChange={(event) => setSignupPasswordConfirm(event.target.value)}
                      className="login-input"
                      placeholder="비밀번호를 다시 입력하세요"
                    />
                  </div>
                  <div className="login-field-group">
                    <label htmlFor="signup-season">시즌-최고티어</label>
                    <div className="tier-field-row">
                      <select
                        id="signup-season"
                        value={signupSeason}
                        onChange={(event) => setSignupSeason(event.target.value)}
                        className="login-select"
                      >
                        <option value="">시즌 선택</option>
                        {SEASON_OPTIONS.map((season) => (
                          <option key={season} value={season}>
                            {season}
                          </option>
                        ))}
                      </select>
                      <select
                        id="signup-tier"
                        value={signupTier}
                        onChange={(event) => setSignupTier(event.target.value)}
                        className="login-select"
                      >
                        <option value="">티어 선택</option>
                        {TIER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {findTierOption(signupTier)?.requiresLp && (
                        <input
                          id="signup-lp"
                          value={signupLp}
                          onChange={(event) => setSignupLp(event.target.value.replace(/\D/g, ''))}
                          className="login-input tier-lp-input"
                          inputMode="numeric"
                          placeholder="LP"
                        />
                      )}
                    </div>
                  </div>
                  <div className="login-field-group">
                    <label htmlFor="signup-main-line">주라인</label>
                    <select
                      id="signup-main-line"
                      value={signupMainLine}
                      onChange={(event) => setSignupMainLine(event.target.value)}
                      className="login-select"
                    >
                      <option value="">주라인 선택</option>
                      <option value="TOP">TOP</option>
                      <option value="JUNGLE">JUNGLE</option>
                      <option value="MID">MID</option>
                      <option value="ADC">ADC</option>
                      <option value="SUP">SUP</option>
                    </select>
                  </div>
                  <div className="login-actions">
                    <button type="button" className="login-submit-button" onClick={handleSignupSubmit}>
                      회원가입
                    </button>
                    <button
                      type="button"
                      className="signup-button"
                      onClick={() => {
                        setAuthMode('login')
                        setAuthFeedback('')
                      }}
                    >
                      로그인으로
                    </button>
                  </div>
                </>
              )}

              {authMode === 'pending' && (
                <section className="pending-card" aria-label="승인 대기 안내">
                  <h3>승인 대기중</h3>
                  <p>
                    {pendingAccountId || '해당 계정'}은 현재 운영자 승인 대기 상태입니다.
                    <br />
                    승인 완료 후 로그인 가능합니다.
                  </p>
                  <button
                    type="button"
                    className="signup-button"
                    onClick={() => {
                      setAuthMode('login')
                      setAuthFeedback('')
                      setPendingAccountId('')
                    }}
                  >
                    로그인으로
                  </button>
                </section>
              )}
              {authFeedback && (
                <p className={authFeedbackType === 'error' ? 'auth-feedback is-error' : 'auth-feedback is-success'}>
                  {authFeedback}
                </p>
              )}
            </article>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && activeMenu === '홈' && (
          <section className="template-hero">
            <div className="template-slot" role="region" aria-label="서버 템플릿 슬롯">
              <div className="slot-glow" aria-hidden="true" />
              <div className="slot-card">
                <div className="slot-content">
                  <h2 className="slot-title">서버 템플릿 카드</h2>
                  <p className="slot-description">서버에서 내려준 컴포넌트가 이 영역 안에 렌더링됩니다.</p>
                </div>
              </div>
            </div>

            <div className="searchbar-wrap" role="search" aria-label="전적 검색">
              <button className="region-chip" type="button">
                KR
              </button>
              <input
                className="search-input"
                value={homeSearchInput}
                onChange={(event) => setHomeSearchInput(event.target.value)}
                placeholder="플레이어 이름 + #태그"
                aria-label="플레이어 이름과 태그 검색"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleHomeSearchSubmit()
                  }
                }}
              />
              <button className="search-icon-button" type="button" aria-label="검색" onClick={handleHomeSearchSubmit}>
                ⌕
              </button>
            </div>

            <section className="stats-grid" aria-label="주간 통계">
              <article className="info-panel">
                <header className="panel-header">
                  <h3 className="panel-title-static">
                    이번주 MVP TOP 5
                  </h3>
                </header>
                {homeTopLoading ? (
                  <p className="panel-empty">불러오는 중...</p>
                ) : homeTopError ? (
                  <p className="panel-empty">{homeTopError}</p>
                ) : homeMvpTopRows.length === 0 ? (
                  <p className="panel-empty">데이터가 없습니다.</p>
                ) : (
                  <ul className="panel-list">
                    {homeMvpTopRows.slice(0, 5).map((row, index) => (
                      <li key={`mvp-${row.riotId}`}>
                        <span className="home-top-player">
                          {typeof row.profileIconId === 'number' && row.profileIconId > 0 ? (
                            <img
                              src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${row.profileIconId}.png`}
                              alt=""
                              className="home-top-icon"
                            />
                          ) : (
                            <span className="home-top-icon-empty">-</span>
                          )}
                          <button
                            type="button"
                            className="home-top-name-button"
                            onClick={() => handleOpenRecordFromStats(row.riotId)}
                          >
                            {index + 1}. {row.riotId}
                          </button>
                        </span>
                        <strong>{row.mvpCount}회</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="info-panel">
                <header className="panel-header">
                  <button type="button" className="panel-title-link" onClick={handleOpenRecordKdaRanking}>
                    KDA TOP 5
                  </button>
                </header>
                {homeTopLoading ? (
                  <p className="panel-empty">불러오는 중...</p>
                ) : homeTopError ? (
                  <p className="panel-empty">{homeTopError}</p>
                ) : homeKdaTopRows.length === 0 ? (
                  <p className="panel-empty">데이터가 없습니다.</p>
                ) : (
                  <ul className="panel-list">
                    {homeKdaTopRows.slice(0, 5).map((row, index) => (
                      <li key={`kda-${row.riotId}`}>
                        <span className="home-top-player">
                          {typeof row.profileIconId === 'number' && row.profileIconId > 0 ? (
                            <img
                              src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${row.profileIconId}.png`}
                              alt=""
                              className="home-top-icon"
                            />
                          ) : (
                            <span className="home-top-icon-empty">-</span>
                          )}
                          <button
                            type="button"
                            className="home-top-name-button"
                            onClick={() => handleOpenRecordFromStats(row.riotId)}
                          >
                            {index + 1}. {row.riotId}
                          </button>
                        </span>
                        <strong className={getKdaTierClass(row.avgKda)}>{row.avgKda.toFixed(2)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </section>

            <article className="schedule-panel" aria-label="다가오는 내전 일정">
              <header className="panel-header">
                <button type="button" className="panel-title-link" onClick={() => setActiveMenu('내전신청')}>
                  다가오는 내전 일정
                </button>
                <button
                  type="button"
                  className="panel-apply-button"
                  onClick={() => {
                    setActiveMenu('내전신청')
                    setIsLoginPage(false)
                    setIsUserInfoPage(false)
                    setAuthMode('login')
                    setAuthFeedback('')
                    setPendingAccountId('')
                  }}
                >
                  신청하기
                </button>
              </header>
              {homeUpcomingInhouseCards.length === 0 ? (
                <p className="panel-empty">등록된 일정이 없습니다.</p>
              ) : (
                <ul className="panel-list">
                  {homeUpcomingInhouseCards.map((card) => (
                    <li key={`home-upcoming-${card.id}`}>
                      <div className="home-upcoming-meta">
                        <p>
                          <span>제목</span>
                          <strong>{card.title || '-'}</strong>
                        </p>
                        <p>
                          <span>날짜</span>
                          <strong>{formatInhouseStartAt(card.startAt) || '-'}</strong>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && activeMenu === '내전신청' && (
          <section className="record-page inhouse-page">
            <header className="record-headline">
              <h2>내전신청</h2>
            
            </header>

            <section className="inhouse-layout">
              <aside className="inhouse-category-sidebar" aria-label="내전 신청 카테고리">
                <h3></h3>
                <div className="inhouse-category-list">
                  {INHOUSE_CATEGORY_OPTIONS.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      className={inhouseCategory === category.value ? 'is-active' : ''}
                      onClick={() => setInhouseCategory(category.value)}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </aside>

              <article className="inhouse-content-panel">
                <div className="inhouse-content-header">
                  <h3>{currentInhouseCategory.title}</h3>
                  {isAdminSession && (
                    <button
                      type="button"
                      className="record-action-button inhouse-create-button"
                      onClick={() => {
                        setInhouseCreateFeedback('')
                        setInhouseCreateTitle('')
                        setInhouseCreateStartAt('')
                        setIsInhouseCreateModalOpen(true)
                      }}
                    >
                      내전 만들기
                    </button>
                  )}
                </div>
                {currentInhouseCards.length === 0 ? (
                  <p className="panel-empty">생성된 일정이 없습니다.</p>
                ) : (
                  <div className="inhouse-card-list">
                    {currentInhouseCards.map((card) => (
                      <article key={card.id} className="inhouse-created-card">
                        <div className="inhouse-created-card-meta">
                          <strong>{card.title}</strong>
                          <span className="inhouse-time-row">
                            <span className="inhouse-time-icon" aria-hidden="true" />
                            시작 시간: {formatInhouseStartAt(card.startAt)}
                          </span>
                          <div className="inhouse-applicant-lists">
                            <p>
                              신청인원: {getInhouseApplicantsByStatus(card.id, 'applied').length}명
                            </p>
                            <p>
                              대기신청인원: {getInhouseApplicantsByStatus(card.id, 'waiting').length}명
                            </p>
                          </div>
                        </div>
                        <div className="inhouse-card-actions">
                          {isAdminSession && (
                            <>
                              <button
                                type="button"
                                className="inhouse-edit-button"
                                onClick={() => openInhouseEditModal(card)}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="inhouse-teamdraw-button"
                                onClick={() => openTeamDrawPage(card.id)}
                              >
                                팀뽑기
                              </button>
                            </>
                          )}
                            {getInhouseApplyStatusForCurrentUser(card.id) ? (
                              <button
                                type="button"
                                className="record-action-button inhouse-apply-button"
                                onClick={() => handleCancelInhouseApply(card.id)}
                              >
                                취소
                              </button>
                            ) : (
                            <button
                              type="button"
                                className="record-action-button inhouse-apply-button"
                                onClick={() => openInhouseApplyModal(card.id)}
                              >
                                신청
                              </button>
                            )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && isAdminSession && activeMenu === MEMBER_MENU && (
          <section className="record-page">
            <header className="record-headline">
              <div className="teamdraw-title-row">
                <h2>맴버</h2>
                <div className="teamdraw-nav-controls">
                  <button type="button" className="teamdraw-nav-button" onClick={() => setActiveMenu('내전신청')}>
                    뒤로가기
                  </button>
                  <button type="button" className="teamdraw-nav-button is-primary" onClick={() => setActiveMenu(TEAM_DRAW_MENU)}>
                    시드
                  </button>
                  <button
                    type="button"
                    className="teamdraw-nav-button is-primary"
                    onClick={() => setActiveMenu(TEAM_SELECT_MENU)}
                  >
                    팀 선정
                  </button>
                </div>
              </div>
              <p>{currentTeamDrawCard ? `${currentTeamDrawCard.title} / ${currentTeamDrawCard.startAt}` : '내전을 선택해주세요.'}</p>
            </header>

            <section className="record-panel record-panel-full teamdraw-panel">
              {currentTeamDrawCard ? (
                <>
                  <section className="teamdraw-list-section">
                    <h4>신청 인원 목록 ({appliedTeamDrawMembers.length})</h4>
                    {appliedTeamDrawMembers.length === 0 ? (
                      <p className="panel-empty">신청 인원이 없습니다.</p>
                    ) : (
                      <div className="teamdraw-member-list">
                        {appliedTeamDrawMembers.map((item) => (
                          <article key={item.application.id} className="teamdraw-member-card">
                            <div className="teamdraw-member-main">
                              <div className="teamdraw-member-avatar">
                                {item.riotId !== '-' && typeof profileIconByRiotId[item.riotId] === 'number' ? (
                                  <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${profileIconByRiotId[item.riotId]}.png`}
                                    alt=""
                                  />
                                ) : (
                                  <span>{item.application.userLabel.slice(0, 1)}</span>
                                )}
                              </div>
                              <div className="teamdraw-member-meta">
                                <strong>{item.riotId}</strong>
                                <span>디스코드: {item.discordId}</span>
                              </div>
                            </div>
                            <div className="teamdraw-member-actions">
                              <button
                                type="button"
                                className="inhouse-teamdraw-button"
                                onClick={() => handleTeamDrawMoveApplication(item.application.id, 'waiting')}
                              >
                                대기
                              </button>
                              <button
                                type="button"
                                className="inhouse-modal-delete-button teamdraw-delete-button"
                                onClick={() => handleTeamDrawDeleteApplication(item.application.id)}
                              >
                                삭제
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="teamdraw-list-section">
                    <h4>대기인원 목록 ({waitingTeamDrawMembers.length})</h4>
                    {waitingTeamDrawMembers.length === 0 ? (
                      <p className="panel-empty">대기 인원이 없습니다.</p>
                    ) : (
                      <div className="teamdraw-member-list">
                        {waitingTeamDrawMembers.map((item) => (
                          <article key={item.application.id} className="teamdraw-member-card">
                            <div className="teamdraw-member-main">
                              <div className="teamdraw-member-avatar">
                                {item.riotId !== '-' && typeof profileIconByRiotId[item.riotId] === 'number' ? (
                                  <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${profileIconByRiotId[item.riotId]}.png`}
                                    alt=""
                                  />
                                ) : (
                                  <span>{item.application.userLabel.slice(0, 1)}</span>
                                )}
                              </div>
                              <div className="teamdraw-member-meta">
                                <strong>{item.riotId}</strong>
                                <span>디스코드: {item.discordId}</span>
                              </div>
                            </div>
                            <div className="teamdraw-member-actions">
                              <button
                                type="button"
                                className="record-action-button inhouse-apply-button"
                                onClick={() => handleTeamDrawMoveApplication(item.application.id, 'applied')}
                              >
                                신청
                              </button>
                              <button
                                type="button"
                                className="inhouse-modal-delete-button teamdraw-delete-button"
                                onClick={() => handleTeamDrawDeleteApplication(item.application.id)}
                              >
                                삭제
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <p className="panel-empty">선택된 내전이 없습니다.</p>
              )}
            </section>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && isAdminSession && activeMenu === TEAM_DRAW_MENU && (
          <section className="record-page seed-page">
            <header className="record-headline">
              <div className="teamdraw-title-row">
                <h2>시드</h2>
                <div className="teamdraw-nav-controls">
                  <button type="button" className="teamdraw-nav-button" onClick={() => setActiveMenu(MEMBER_MENU)}>
                    뒤로가기
                  </button>
                  <button
                    type="button"
                    className="teamdraw-nav-button is-primary"
                    onClick={() => setActiveMenu(TEAM_SELECT_MENU)}
                  >
                    팀 선정
                  </button>
                </div>
              </div>
              <p>{currentTeamDrawCard ? `${currentTeamDrawCard.title} / ${currentTeamDrawCard.startAt}` : '내전을 선택해주세요.'}</p>
            </header>

            <section className="record-panel record-panel-full teamdraw-panel">
              {currentTeamDrawCard ? (
                <>
                  {appliedTeamDrawMembers.length === 0 ? (
                    <p className="panel-empty">신청 인원이 없습니다.</p>
                  ) : (
                    <div className="seed-row-list-scroll">
                      <div className="seed-row-list">
                        {visibleSeedRows.map((row, rowIndex) => (
                          <div
                            key={`seed-row-${row.seedNumber}`}
                            className="seed-row"
                            style={
                              { '--seed-accent': SEED_ROW_ACCENTS[rowIndex] ?? SEED_ROW_ACCENTS[0] } as CSSProperties
                            }
                          >
                            <div className="seed-row-header">
                              <span>{row.seedNumber}시드</span>
                              <div className="seed-row-line" aria-hidden="true" />
                            </div>
                            <div className="seed-grid">
                              {row.members.map((item) => {
                                const seedNumber = row.seedNumber
                                const highestTier = formatHighestTierChipText(getSignupSeasonPeakTierFromRiotId(item.riotId))
                                const currentTier = currentTierByRiotId[item.riotId] ?? 'UNRANKED'
                                const mainLine = getSignupMainLineFromRiotId(item.riotId)
                                const inhouseStat = getInhouseStatByRiotId(item.riotId)
                                const seedSp = calculateSeedSp(item.riotId)
                                const winRateValue = inhouseStat?.winRate ?? 0
                                const winRateText = `${winRateValue}%`
                                const scoreText = `(${inhouseStat?.wins ?? 0}승 ${inhouseStat?.losses ?? 0}패)`
                                return (
                                  <article key={item.application.id} className="seed-card">
                                    <header className="seed-card-head">
                                      <span>{seedNumber}시드</span>
                                      <strong>{seedSp.toFixed(1)}점</strong>
                                    </header>
                                    <div className="seed-card-body">
                                      <div className="seed-card-avatar">
                                        {item.riotId !== '-' && typeof profileIconByRiotId[item.riotId] === 'number' ? (
                                          <img
                                            src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${profileIconByRiotId[item.riotId]}.png`}
                                            alt=""
                                          />
                                        ) : (
                                          <span>{item.application.userLabel.slice(0, 1)}</span>
                                        )}
                                      </div>
                                      <div className="seed-card-meta">
                                        <strong>{item.riotId}</strong>
                                        <p className="seed-tier-chips">
                                          <span className={`seed-tier-chip ${getTierColorClass(highestTier)}`}>{highestTier}</span>
                                          <span className={`seed-tier-chip ${getTierColorClass(currentTier)}`}>{currentTier}</span>
                                          <span className="seed-tier-chip seed-line-chip">{mainLine}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="seed-card-footer">
                                      <span className="seed-discord-chip">
                                        <span className="seed-discord-icon" aria-hidden="true">
                                          🎧
                                        </span>
                                        <span>{item.discordId}</span>
                                      </span>
                                      <div className="seed-card-inhouse">
                                        <strong className={getWinRateTierClass(winRateValue)}>{winRateText}</strong>
                                        <span>{scoreText}</span>
                                      </div>
                                    </div>
                                  </article>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="panel-empty">선택된 내전이 없습니다.</p>
              )}
            </section>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && isAdminSession && activeMenu === TEAM_SELECT_MENU && (
          <section className="record-page seed-page">
            <header className="record-headline">
              <div className="teamdraw-title-row">
                <h2>팀 선정</h2>
                <div className="teamdraw-nav-controls">
                  <button type="button" className="teamdraw-nav-button" onClick={() => setActiveMenu(MEMBER_MENU)}>
                    뒤로가기
                  </button>
                  <button
                    type="button"
                    className="teamdraw-nav-button is-primary"
                    onClick={handleConfirmTeamSelectBracket}
                  >
                    확정
                  </button>
                </div>
              </div>
              <p>{currentTeamDrawCard ? `${currentTeamDrawCard.title} / ${currentTeamDrawCard.startAt}` : '내전을 선택해주세요.'}</p>
            </header>

            <section className="record-panel record-panel-full teamdraw-panel">
              {currentTeamDrawCard ? (
                <>
                  {teamSelectMembers.length === 0 ? (
                    <p className="panel-empty">신청 인원이 없습니다.</p>
                  ) : (
                    <>
                      <div
                        className="teamselect-grid"
                        style={{ gridTemplateColumns: `repeat(${teamColumns.length}, minmax(220px, 1fr))` }}
                      >
                        {teamColumns.map((team) => (
                          <section key={`team-column-${team.teamNumber}`} className="teamselect-column">
                            <article className="teamselect-summary-card teamselect-column-summary" style={{ background: team.color }}>
                              <strong>{team.teamNumber}팀</strong>
                              <span>{team.teamSp.toFixed(1)}점</span>
                            </article>
                            <div className="teamselect-seed-list">
                              {team.slots.map((slot) => {
                                const item = slot.member
                                if (!item) {
                                  const isPickerOpen =
                                    teamSelectPickerSlot?.seedNumber === slot.seedNumber &&
                                    teamSelectPickerSlot?.teamNumber === team.teamNumber
                                  return (
                                    <article key={`team-empty-${team.teamNumber}-${slot.seedNumber}`} className="seed-card is-empty">
                                      <header className="seed-card-head">
                                        <span>{slot.seedNumber}시드</span>
                                        <span className="teamselect-cancel-placeholder" />
                                      </header>
                                      <div className="seed-card-body">
                                        {isPickerOpen ? (
                                          <div className="teamselect-inline-picker">
                                            <select
                                              value={teamSelectPickerMemberId}
                                              onChange={(event) => setTeamSelectPickerMemberId(event.target.value)}
                                              className="teamselect-inline-select"
                                            >
                                              {teamSelectPickerCandidates.map((member) => (
                                                <option key={member.application.id} value={member.application.id}>
                                                  {member.riotId}
                                                </option>
                                              ))}
                                            </select>
                                            <div className="teamselect-inline-actions">
                                              <button
                                                type="button"
                                                className="teamselect-inline-button is-primary"
                                                onClick={handleConfirmTeamSelectInlineAssign}
                                              >
                                                확인
                                              </button>
                                              <button
                                                type="button"
                                                className="teamselect-inline-button"
                                                onClick={() => {
                                                  setTeamSelectPickerSlot(null)
                                                  setTeamSelectPickerMemberId('')
                                                }}
                                              >
                                                취소
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            className="teamselect-plus-button"
                                            onClick={() => openTeamSelectInlinePicker(slot.seedNumber, team.teamNumber)}
                                          >
                                            +
                                          </button>
                                        )}
                                      </div>
                                    </article>
                                  )
                                }
                                const highestTier = formatHighestTierChipText(getSignupSeasonPeakTierFromRiotId(item.riotId))
                                const currentTier = currentTierByRiotId[item.riotId] ?? 'UNRANKED'
                                const mainLine = getSignupMainLineFromRiotId(item.riotId)
                                const inhouseStat = getInhouseStatByRiotId(item.riotId)
                                const seedSp = calculateSeedSp(item.riotId)
                                const winRateValue = inhouseStat?.winRate ?? 0
                                const winRateText = `${winRateValue}%`
                                const scoreText = `(${inhouseStat?.wins ?? 0}승 ${inhouseStat?.losses ?? 0}패)`
                                const isManualAssigned = Boolean(teamSelectAssignments[slot.seedNumber]?.[team.teamNumber])
                                return (
                                  <article key={item.application.id} className="seed-card">
                                    <header className="seed-card-head">
                                      <span className="teamselect-head-left">
                                        {slot.seedNumber}시드
                                        <strong>{seedSp.toFixed(1)}점</strong>
                                      </span>
                                      {isManualAssigned ? (
                                        <button
                                          type="button"
                                          className="teamselect-cancel-button"
                                          onClick={() => handleCancelTeamSelectAssignment(slot.seedNumber, team.teamNumber)}
                                          aria-label="선택 취소"
                                        >
                                          X
                                        </button>
                                      ) : (
                                        <span className="teamselect-cancel-placeholder" />
                                      )}
                                    </header>
                                    <div className="seed-card-body">
                                      <div className="seed-card-avatar">
                                        {item.riotId !== '-' && typeof profileIconByRiotId[item.riotId] === 'number' ? (
                                          <img
                                            src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${profileIconByRiotId[item.riotId]}.png`}
                                            alt=""
                                          />
                                        ) : (
                                          <span>{item.application.userLabel.slice(0, 1)}</span>
                                        )}
                                      </div>
                                      <div className="seed-card-meta">
                                        <strong>{item.riotId}</strong>
                                        <p className="seed-tier-chips">
                                          <span className={`seed-tier-chip ${getTierColorClass(highestTier)}`}>{highestTier}</span>
                                          <span className={`seed-tier-chip ${getTierColorClass(currentTier)}`}>{currentTier}</span>
                                          <span className="seed-tier-chip seed-line-chip">{mainLine}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="seed-card-footer">
                                      <span className="seed-discord-chip">
                                        <span className="seed-discord-icon" aria-hidden="true">
                                          🎧
                                        </span>
                                        <span>{item.discordId}</span>
                                      </span>
                                      <div className="seed-card-inhouse">
                                        <strong className={getWinRateTierClass(winRateValue)}>{winRateText}</strong>
                                        <span>{scoreText}</span>
                                      </div>
                                    </div>
                                  </article>
                                )
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="panel-empty">선택된 내전이 없습니다.</p>
              )}
            </section>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && isAdminSession && activeMenu === TEAM_BRACKET_MENU && (
          <section className="record-page">
            <header className="record-headline">
              <div className="teamdraw-title-row">
                <h2>대진표</h2>
                <div className="teamdraw-nav-controls">
                  <button type="button" className="teamdraw-nav-button" onClick={() => setActiveMenu(TEAM_SELECT_MENU)}>
                    뒤로가기
                  </button>
                  <button type="button" className="teamdraw-nav-button is-primary" onClick={handleSaveTeamBracketRecord}>
                    저장
                  </button>
                </div>
              </div>
              <p>{currentTeamDrawCard ? `${currentTeamDrawCard.title} / ${currentTeamDrawCard.startAt}` : '내전을 선택해주세요.'}</p>
            </header>

            <section className="record-panel record-panel-full teamdraw-panel">
              {currentTeamBracket && currentTeamBracket.groups.length > 0 ? (
                <div className="bracket-group-list">
                  {currentTeamBracket.groups.map((group) => {
                    const semifinalMatches = group.matches.filter((match) => (match.stage ?? 'semi') === 'semi').slice(0, 2)
                    const finalMatch = group.matches.find((match) => match.stage === 'final') ?? null
                    const lowerMatch = group.matches.find((match) => match.stage === 'lower') ?? null
                    const finalMatchId = finalMatch?.id ?? `${group.label}-final`
                    const lowerMatchId = lowerMatch?.id ?? `${group.label}-lower`
                    const finalCode = finalMatch?.tournamentCode ?? null
                    const lowerCode = lowerMatch?.tournamentCode ?? null
                    const firstSemi = semifinalMatches[0] ?? null
                    const secondSemi = semifinalMatches[1] ?? null
                    const getWinnerTeam = (match: TeamBracketMatch | null) => {
                      if (!match) return null
                      if (match.winner === 'A') return match.teamA
                      if (match.winner === 'B') return match.teamB
                      return null
                    }
                    const getLoserTeam = (match: TeamBracketMatch | null) => {
                      if (!match) return null
                      if (match.winner === 'A') return match.teamB
                      if (match.winner === 'B') return match.teamA
                      return null
                    }
                    const finalistA = getWinnerTeam(firstSemi)
                    const finalistB = getWinnerTeam(secondSemi)
                    const lowerA = getLoserTeam(firstSemi)
                    const lowerB = getLoserTeam(secondSemi)
                    const firstPlace =
                      finalMatch?.winner === 'A' ? finalistA : finalMatch?.winner === 'B' ? finalistB : null
                    const secondPlace =
                      finalMatch?.winner === 'A' ? finalistB : finalMatch?.winner === 'B' ? finalistA : null
                    const thirdPlace =
                      lowerMatch?.winner === 'A' ? lowerA : lowerMatch?.winner === 'B' ? lowerB : null
                    const fourthPlace =
                      lowerMatch?.winner === 'A' ? lowerB : lowerMatch?.winner === 'B' ? lowerA : null
                    return (
                      <section key={group.id} className="bracket-group-card">
                        <h4 className="bracket-group-title">{group.label} 4강</h4>
                        <div className="bracket-layout">
                          <div className="bracket-left-column">
                            <div className="bracket-semis">
                              {semifinalMatches.map((match, matchIndex) => (
                                <article key={match.id} className="bracket-round-card">
                                  <header className="bracket-round-header">
                                    <strong>{group.label} 4강 {matchIndex + 1}경기</strong>
                                    <span className="bracket-round-tools">
                                      <button
                                        type="button"
                                        className="bracket-code-button"
                                        onClick={() =>
                                          handleIssueTournamentCode(
                                            group.id,
                                            match.id,
                                            'semi',
                                            match.teamA ? `${match.teamA.teamNumber}팀` : '빈 팀',
                                            match.teamB ? `${match.teamB.teamNumber}팀` : '빈 팀',
                                          )
                                        }
                                        disabled={
                                          !match.teamA ||
                                          !match.teamB ||
                                          Boolean(tournamentCodeLoadingByMatchId[`${group.id}:${match.id}`])
                                        }
                                      >
                                        {tournamentCodeLoadingByMatchId[`${group.id}:${match.id}`] ? '발급중' : '코드 발급'}
                                      </button>
                                      {match.tournamentCode && <code>{match.tournamentCode}</code>}
                                    </span>
                                  </header>
                                  <div className="bracket-round-body">
                                    <button
                                      type="button"
                                      className={`bracket-team-button ${match.winner === 'A' ? 'is-winner' : ''}`}
                                      onClick={() => handleSelectBracketWinner(group.id, match.id, 'A')}
                                    >
                                      <span className="bracket-team-name">
                                        {match.teamA ? `${match.teamA.teamNumber}팀` : '빈 팀'}
                                      </span>
                                    </button>
                                    <div className="bracket-round-vs">VS</div>
                                    <button
                                      type="button"
                                      className={`bracket-team-button ${match.winner === 'B' ? 'is-winner' : ''}`}
                                      onClick={() => handleSelectBracketWinner(group.id, match.id, 'B')}
                                      disabled={!match.teamB}
                                    >
                                      <span className="bracket-team-name">
                                        {match.teamB ? `${match.teamB.teamNumber}팀` : '부전승'}
                                      </span>
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>

                          <div className="bracket-right-column">
                            <article className="bracket-round-card bracket-final-card">
                              <header className="bracket-round-header">
                                <strong>{group.label} 결승</strong>
                                <span className="bracket-round-tools">
                                  <button
                                    type="button"
                                    className="bracket-code-button"
                                    onClick={() =>
                                      handleIssueTournamentCode(
                                        group.id,
                                        finalMatchId,
                                        'final',
                                        finalistA ? `${finalistA.teamNumber}팀` : '승자 대기',
                                        finalistB ? `${finalistB.teamNumber}팀` : '승자 대기',
                                      )
                                    }
                                    disabled={
                                      !finalistA ||
                                      !finalistB ||
                                      Boolean(tournamentCodeLoadingByMatchId[`${group.id}:${finalMatchId}`])
                                    }
                                  >
                                    {tournamentCodeLoadingByMatchId[`${group.id}:${finalMatchId}`] ? '발급중' : '코드 발급'}
                                  </button>
                                  {finalCode && <code>{finalCode}</code>}
                                </span>
                              </header>
                              <div className="bracket-round-body">
                                <button
                                  type="button"
                                  className={`bracket-team-button ${finalMatch?.winner === 'A' ? 'is-winner' : ''}`}
                                  onClick={() => handleSelectBracketWinner(group.id, finalMatchId, 'A')}
                                  disabled={!finalistA}
                                >
                                  <span className="bracket-team-name">
                                    {finalistA ? `${finalistA.teamNumber}팀` : '승자 대기'}
                                  </span>
                                </button>
                                <div className="bracket-round-vs">VS</div>
                                <button
                                  type="button"
                                  className={`bracket-team-button ${finalMatch?.winner === 'B' ? 'is-winner' : ''}`}
                                  onClick={() => handleSelectBracketWinner(group.id, finalMatchId, 'B')}
                                  disabled={!finalistB}
                                >
                                  <span className="bracket-team-name">
                                    {finalistB ? `${finalistB.teamNumber}팀` : '승자 대기'}
                                  </span>
                                </button>
                              </div>
                            </article>

                            <article className="bracket-round-card">
                              <header className="bracket-round-header">
                                <strong>{group.label} 패자조(3·4위전)</strong>
                                <span className="bracket-round-tools">
                                  <button
                                    type="button"
                                    className="bracket-code-button"
                                    onClick={() =>
                                      handleIssueTournamentCode(
                                        group.id,
                                        lowerMatchId,
                                        'lower',
                                        lowerA ? `${lowerA.teamNumber}팀` : '패자 대기',
                                        lowerB ? `${lowerB.teamNumber}팀` : '패자 대기',
                                      )
                                    }
                                    disabled={
                                      !lowerA ||
                                      !lowerB ||
                                      Boolean(tournamentCodeLoadingByMatchId[`${group.id}:${lowerMatchId}`])
                                    }
                                  >
                                    {tournamentCodeLoadingByMatchId[`${group.id}:${lowerMatchId}`] ? '발급중' : '코드 발급'}
                                  </button>
                                  {lowerCode && <code>{lowerCode}</code>}
                                </span>
                              </header>
                              <div className="bracket-round-body">
                                <button
                                  type="button"
                                  className={`bracket-team-button ${lowerMatch?.winner === 'A' ? 'is-winner' : ''}`}
                                  onClick={() => handleSelectBracketWinner(group.id, lowerMatchId, 'A')}
                                  disabled={!lowerA}
                                >
                                  <span className="bracket-team-name">{lowerA ? `${lowerA.teamNumber}팀` : '패자 대기'}</span>
                                </button>
                                <div className="bracket-round-vs">VS</div>
                                <button
                                  type="button"
                                  className={`bracket-team-button ${lowerMatch?.winner === 'B' ? 'is-winner' : ''}`}
                                  onClick={() => handleSelectBracketWinner(group.id, lowerMatchId, 'B')}
                                  disabled={!lowerB}
                                >
                                  <span className="bracket-team-name">{lowerB ? `${lowerB.teamNumber}팀` : '패자 대기'}</span>
                                </button>
                              </div>
                            </article>
                          </div>

                          <section
                            className="bracket-rank-card"
                            style={{ width: 'min(100%, 435px)', marginInline: 'auto', justifySelf: 'center' }}
                          >
                            <h5>최종 순위</h5>
                            <p className="bracket-rank-row">
                              <strong className="bracket-rank-badge is-first">1등</strong>
                              <span className="bracket-rank-team">{firstPlace ? `${firstPlace.teamNumber}팀` : '-'}</span>
                            </p>
                            <p className="bracket-rank-row">
                              <strong className="bracket-rank-badge is-second">2등</strong>
                              <span className="bracket-rank-team">{secondPlace ? `${secondPlace.teamNumber}팀` : '-'}</span>
                            </p>
                            <p className="bracket-rank-row">
                              <strong className="bracket-rank-badge is-third">3등</strong>
                              <span className="bracket-rank-team">{thirdPlace ? `${thirdPlace.teamNumber}팀` : '-'}</span>
                            </p>
                            <p className="bracket-rank-row">
                              <strong className="bracket-rank-badge">4등</strong>
                              <span className="bracket-rank-team">{fourthPlace ? `${fourthPlace.teamNumber}팀` : '-'}</span>
                            </p>
                          </section>
                        </div>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <p className="panel-empty">팀선정에서 확정을 누르면 대진표가 생성됩니다.</p>
              )}
            </section>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && activeMenu === '전적' && (
          <section className="record-page record-page-search">
            <header className="record-headline">
              <h2>내전 전적 검색</h2>
              <p>소환사를 검색해 프로필을 확인하세요.</p>
            </header>

            <section className="record-search-card">
              <div className="record-search-title">
                <strong>소환사명</strong>
                <span>KR 서버</span>
              </div>
              <div className="record-search-row">
                <input
                  value={recordInput}
                  onChange={(event) => setRecordInput(event.target.value)}
                  className="record-search-input"
                  placeholder="소환사명 + #태그 (예: Faker#KR1)"
                  aria-label="아이디와 태그 검색"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleRecordSearch()
                    }
                  }}
                />
                <button
                  type="button"
                  className="record-search-button"
                  onClick={() => void handleRecordSearch()}
                  disabled={recordLoading}
                >
                  {recordLoading ? '조회중' : '검색'}
                </button>
              </div>
            </section>

            {recordError && (
              <div className="record-error-box">
                <p className="record-error">{getRecordErrorSummary(recordError)}</p>
                <button
                  type="button"
                  className="record-error-detail-toggle"
                  onClick={() => setIsRecordErrorDetailOpen((prev) => !prev)}
                >
                  {isRecordErrorDetailOpen ? '자세히 닫기' : '자세히 보기'}
                </button>
                {isRecordErrorDetailOpen && <pre className="record-error-detail">{recordError}</pre>}
              </div>
            )}

            {recordData && (
              <>
                <section className="record-result-grid">
                  {(() => {
                    const inhouseStat = getInhouseStatByRiotId(recordData.summoner.riotId)
                    const totalGames = recordPersistedStats?.totalGames ?? inhouseStat.wins + inhouseStat.losses
                    const wins = recordPersistedStats?.wins ?? inhouseStat.wins
                    const losses = recordPersistedStats?.losses ?? inhouseStat.losses
                    const winRate =
                      recordPersistedStats?.winRate ??
                      (totalGames > 0 ? Math.round((inhouseStat.wins / totalGames) * 100) : 0)
                    const totalKills = recordPersistedStats?.totalKills ?? recordData.custom?.kills
                    const totalDeaths = recordPersistedStats?.totalDeaths ?? recordData.custom?.deaths
                    const totalAssists = recordPersistedStats?.totalAssists ?? recordData.custom?.assists
                  const totalKdaText =
                    recordPersistedStats?.totalKda !== null && typeof recordPersistedStats?.totalKda === 'number'
                      ? recordPersistedStats.totalKda.toFixed(2)
                      : typeof totalKills === 'number' &&
                            typeof totalDeaths === 'number' &&
                            typeof totalAssists === 'number'
                          ? totalDeaths > 0
                            ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
                            : (totalKills + totalAssists).toFixed(2)
                          : '-'
                    const totalKdaValue = totalKdaText !== '-' ? Number(totalKdaText) : null
                    const discordId = getSignupDiscordIdFromRiotId(recordData.summoner.riotId)
                    const discordDisplay = discordId === '-' ? '미등록' : discordId
                    const targetRiotKey = normalizeRiotIdValue(recordData.summoner.riotId)
                    const streakRow =
                      recordLeaderboardRows.find((row) => normalizeRiotIdValue(row.riotId) === targetRiotKey) ?? null
                    const soloWinRate = recordData.rankedSolo
                      ? (() => {
                          const total = recordData.rankedSolo.wins + recordData.rankedSolo.losses
                          return total > 0 ? Math.round((recordData.rankedSolo.wins / total) * 100) : 0
                        })()
                      : null
                    const chartStyle: CSSProperties = {
                      background: `conic-gradient(#4f8ef3 0 ${winRate}%, #f05e66 ${winRate}% 100%)`,
                    }
                    return (
                      <>
                        <article className="record-user-card">
                          <div className="record-user-layout">
                            <div className="record-user-top">
                              <div className="record-user-icon-wrap">
                                <img
                                  src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${recordData.summoner.profileIconId}.png`}
                                  alt=""
                                />
                              </div>
                              <div className="record-user-meta">
                                <div className="record-user-meta-top">
                                  <div className="record-user-title-row">
                                    <h3>{recordData.summoner.riotId}</h3>
                                    <span className="record-discord-inline-chip">
                                      <span aria-hidden="true">🎧</span>
                                      {discordDisplay}
                                    </span>
                                  </div>
                                </div>
                                <div className="record-user-meta-bottom">
                                  <div className="record-rank-row">
                                    <span className="record-rank-badge">{formatRank(recordData.rankedSolo)}</span>
                                    <span className="record-rank-stat">
                                      {recordData.rankedSolo ? `${recordData.rankedSolo.leaguePoints} LP` : '-'}
                                    </span>
                                    <span className="record-rank-stat">
                                      승률 <strong className={getWinRateTierClass(soloWinRate)}>{formatWinRate(recordData.rankedSolo)}</strong>
                                    </span>
                                  </div>
                                  <div className="record-extra-pill-row">
                                    <span className="record-extra-pill record-extra-pill-primary">
                                      {getSignupSeasonPeakTierFromRiotId(recordData.summoner.riotId)}
                                    </span>
                                    <span className="record-extra-pill">{formatInhouseScore(recordData)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="record-action-column">
                              <div className="record-action-streak-wrap">
                                {streakRow?.streakType === 'win' ? (
                                  <span className="record-streak-chip is-win">
                                    {(streakRow.streakCount ?? 0) >= 10
                                      ? '🔥🔥🔥'
                                      : (streakRow.streakCount ?? 0) >= 5
                                        ? '🔥🔥'
                                        : '🔥'}{' '}
                                    {streakRow.streakCount ?? 0}연승중
                                  </span>
                                ) : streakRow?.streakType === 'loss' ? (
                                  <span className="record-streak-chip is-loss">{streakRow.streakCount ?? 0}연패중</span>
                                ) : (
                                  <span className="record-stats-icon-empty">-</span>
                                )}
                              </div>
                              <button type="button" className="record-action-button" onClick={handleOpenFowProfile}>
                                솔랭 전적
                              </button>
                            </div>
                          </div>
                        </article>
                        <article className="record-winrate-side-card" aria-label="내전 승률">
                          <div className="record-winrate-card">
                            <strong className="record-winrate-title">내전 승율</strong>
                            <div className="record-winrate-main">
                              <div className="record-winrate-chart" style={chartStyle}>
                                <span className={getWinRateTierClass(winRate)}>{winRate}%</span>
                              </div>
                            </div>
                            <div className="record-winrate-meta">
                              <strong>
                                {totalGames} 게임 ({wins}승 {losses}패)
                              </strong>
                            </div>
                            <div className="record-winrate-kda">
                              <strong className={getKdaTierClass(totalKdaValue)}>{totalKdaText}</strong>
                            </div>
                          </div>
                        </article>
                      </>
                    )
                  })()}
                </section>

                <section className="record-champion-card" aria-label="챔피언 통계">
                  <header className="record-champion-header">
                    <h4>챔피언 통계</h4>
                  </header>
                  {recordPersistedStats?.champions && recordPersistedStats.champions.length > 0 ? (
                    <div className="record-champion-table-wrap">
                      <table className="record-champion-table">
                        <thead>
                          <tr>
                            <th>챔피언</th>
                            <th>게임 수</th>
                            <th>승률</th>
                            <th>KDA</th>
                            <th>K</th>
                            <th>D</th>
                            <th>A</th>
                            <th>승</th>
                            <th>패</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recordPersistedStats.champions.map((champion) => (
                            <tr key={champion.championName}>
                              <td>
                                <div className="record-champion-name-cell">
                                  <img src={getChampionIconUrl(champion.championName)} alt={champion.championName} />
                                  <span>{champion.championName}</span>
                                </div>
                              </td>
                              <td>{champion.games}</td>
                              <td className={getWinRateTierClass(champion.winRate)}>{champion.winRate.toFixed(2)}%</td>
                              <td className={getKdaTierClass(champion.kda)}>{champion.kda.toFixed(2)}</td>
                              <td>{champion.kills.toFixed(2)}</td>
                              <td>{champion.deaths.toFixed(2)}</td>
                              <td>{champion.assists.toFixed(2)}</td>
                              <td>{champion.wins}</td>
                              <td>{champion.losses}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="panel-empty">DB에 저장된 챔피언 통계가 없습니다.</p>
                  )}
                </section>
              </>
            )}
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && activeMenu === '기록' && (
          <section className="record-page inhouse-page record-history-page">
            <header className="record-headline">
              <h2>기록실</h2>
            </header>

            <section className="inhouse-layout">
              <aside className="inhouse-category-sidebar" aria-label="기록 카테고리">
                <h3>기록</h3>
                <div className="inhouse-category-list">
                  <button
                    type="button"
                    className={recordCategoryFilter === 'inhouse-apply' ? 'is-active' : ''}
                    onClick={() => setRecordCategoryFilter('inhouse-apply')}
                  >
                    내전 기록
                  </button>
                  <button
                    type="button"
                    className={recordCategoryFilter === 'bet-apply' ? 'is-active' : ''}
                    onClick={() => setRecordCategoryFilter('bet-apply')}
                  >
                    내기 기록
                  </button>
                  <button
                    type="button"
                    className={recordCategoryFilter === 'detail-record' ? 'is-active' : ''}
                    onClick={() => setRecordCategoryFilter('detail-record')}
                  >
                    상세 기록
                  </button>
                  <button
                    type="button"
                    className={recordCategoryFilter === 'stats' ? 'is-active' : ''}
                    onClick={() => setRecordCategoryFilter('stats')}
                  >
                    통계
                  </button>
                </div>
              </aside>

              <article className="inhouse-content-panel">
                <div className="inhouse-content-header">
                  <h3>
                    {recordCategoryFilter === 'inhouse-apply'
                      ? '내전 기록'
                      : recordCategoryFilter === 'bet-apply'
                        ? '내기 기록'
                        : recordCategoryFilter === 'detail-record'
                          ? '상세 기록'
                          : (
                              <>
                                통계 <span className="stats-top30-chip">🏆 TOP 30</span>
                              </>
                            )}
                  </h3>
                </div>

                {recordCategoryFilter === 'stats' ? (
                  <section className="record-stats-panel">
                    <div className="record-stats-tabs" role="tablist" aria-label="통계 정렬">
                      <button
                        type="button"
                        className={recordStatsView === 'winrate' ? 'is-active' : ''}
                        onClick={() => setRecordStatsView('winrate')}
                      >
                        승률 랭킹
                      </button>
                      <button
                        type="button"
                        className={recordStatsView === 'games' ? 'is-active' : ''}
                        onClick={() => setRecordStatsView('games')}
                      >
                        판수 랭킹
                      </button>
                      <button
                        type="button"
                        className={recordStatsView === 'kda' ? 'is-active' : ''}
                        onClick={() => setRecordStatsView('kda')}
                      >
                        KDA 랭킹
                      </button>
                      <button
                        type="button"
                        className={recordStatsView === 'damage' ? 'is-active' : ''}
                        onClick={() => setRecordStatsView('damage')}
                      >
                        딜량 랭킹
                      </button>
                    </div>
                    {recordStatsError && <p className="record-error">{recordStatsError}</p>}
                    {recordStatsLoading ? (
                      <p className="panel-empty">통계 불러오는 중...</p>
                    ) : recordLeaderboardRows.length === 0 ? (
                      <p className="panel-empty">통계 데이터가 없습니다.</p>
                    ) : (
                      <div className="record-stats-table-wrap">
                        <table className="record-stats-table">
                          <thead>
                            <tr>
                              <th>순위</th>
                              <th>아이콘</th>
                              <th>소환사</th>
                              <th>승률</th>
                              <th>판수</th>
                              <th>평균 KDA</th>
                              <th>딜량</th>
                              <th>최근 흐름</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...recordLeaderboardRows]
                              .sort((a, b) => {
                                if (recordStatsView === 'winrate') {
                                  if (b.winRate !== a.winRate) return b.winRate - a.winRate
                                  return b.games - a.games
                                }
                                if (recordStatsView === 'games') {
                                  if (b.games !== a.games) return b.games - a.games
                                  return b.winRate - a.winRate
                                }
                                if (recordStatsView === 'kda') {
                                  if (b.avgKda !== a.avgKda) return b.avgKda - a.avgKda
                                  return b.games - a.games
                                }
                                if (b.peakDamage !== a.peakDamage) return b.peakDamage - a.peakDamage
                                return b.games - a.games
                              })
                              .slice(0, 30)
                              .map((row, index) => (
                              <tr key={row.riotKey}>
                                <td>{index + 1}</td>
                                <td>
                                  {row.profileIconId ? (
                                    <img
                                      src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${row.profileIconId}.png`}
                                      alt=""
                                      className="record-stats-icon"
                                    />
                                  ) : (
                                    <span className="record-stats-icon-empty">-</span>
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="record-stats-summoner-button"
                                    onClick={() => handleOpenRecordFromStats(row.riotId)}
                                  >
                                    {row.riotId}
                                  </button>
                                </td>
                                <td className={getWinRateTierClass(row.winRate)}>
                                  {row.winRate.toFixed(2)}% ({row.wins}승 {row.losses}패)
                                </td>
                                <td>{row.games}</td>
                                <td className={getKdaTierClass(row.avgKda)}>{row.avgKda.toFixed(2)}</td>
                                <td>{row.peakDamage.toLocaleString()}</td>
                                <td>
                                  {row.streakType === 'win' ? (
                                    <span className="record-streak-chip is-win">
                                      {(row.streakCount ?? 0) >= 10 ? '🔥🔥🔥' : (row.streakCount ?? 0) >= 5 ? '🔥🔥' : '🔥'}{' '}
                                      {row.streakCount ?? 0}연승중
                                    </span>
                                  ) : row.streakType === 'loss' ? (
                                    <span className="record-streak-chip is-loss">{row.streakCount ?? 0}연패중</span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ) : recordCategoryFilter === 'detail-record' ? (
                  detailRecordCards.length === 0 ? (
                    <p className="panel-empty">저장된 내전 대진 정보가 없습니다.</p>
                  ) : (
                    <div className="inhouse-card-list">
                      {detailRecordCards.map((card) => {
                        const isOpen = detailRecordId === card.recordId && detailGroupId === card.groupId
                        const detailRecord = sortedBracketRecords.find((record) => record.id === card.recordId) ?? null
                        const detailGroup = detailRecord?.groups.find((group) => group.groupId === card.groupId) ?? null
                        const semifinalMatches = detailGroup ? detailGroup.matches.filter((match) => match.stage === 'semi').slice(0, 2) : []
                        const finalMatch = detailGroup?.matches.find((match) => match.stage === 'final') ?? null
                        const lowerMatch = detailGroup?.matches.find((match) => match.stage === 'lower') ?? null
                        const detailPlacement = detailGroup?.placement ?? {
                          firstTeamNumber: null,
                          secondTeamNumber: null,
                          thirdTeamNumber: null,
                          fourthTeamNumber: null,
                        }
                        const firstSemi = semifinalMatches[0] ?? null
                        const secondSemi = semifinalMatches[1] ?? null
                        const getWinnerTeamNumber = (match: typeof firstSemi) => match?.winnerTeamNumber ?? null
                        const getLoserTeamNumber = (match: typeof firstSemi) => {
                          if (!match || !match.winnerTeamNumber) return null
                          if (match.winnerTeamNumber === match.teamANumber) return match.teamBNumber
                          if (match.winnerTeamNumber === match.teamBNumber) return match.teamANumber
                          return null
                        }
                        const finalistA = getWinnerTeamNumber(firstSemi)
                        const finalistB = getWinnerTeamNumber(secondSemi)
                        const lowerA = getLoserTeamNumber(firstSemi)
                        const lowerB = getLoserTeamNumber(secondSemi)
                        const firstPlace = finalMatch?.winnerTeamNumber ?? detailPlacement.firstTeamNumber ?? null
                        const thirdPlace = lowerMatch?.winnerTeamNumber ?? detailPlacement.thirdTeamNumber ?? null
                        const finalWinnerDisplay = finalMatch?.winnerTeamNumber ?? firstPlace
                        const lowerWinnerDisplay = lowerMatch?.winnerTeamNumber ?? thirdPlace
                        const finalMatchId = finalMatch?.matchId ?? `${card.groupId}-final`
                        const lowerMatchId = lowerMatch?.matchId ?? `${card.groupId}-lower`
                        const toMatchStorageKey = (matchId: string) => `${card.recordId}:${card.groupId}:${matchId}`
                        const getSemiWinnerDisplay = (match: typeof firstSemi) => {
                          if (!match) return null
                          if (match.winnerTeamNumber) return match.winnerTeamNumber
                          const teamA = match.teamANumber
                          const teamB = match.teamBNumber
                          if (teamA && (teamA === finalistA || teamA === finalistB)) return teamA
                          if (teamB && (teamB === finalistA || teamB === finalistB)) return teamB
                          return null
                        }

                        return (
                          <article key={card.id} className="inhouse-created-card inhouse-record-card">
                            <button
                              type="button"
                              className="inhouse-record-toggle"
                              onClick={() => {
                                if (isOpen) {
                                  setDetailRecordId('')
                                  setDetailGroupId('')
                                  return
                                }
                                setDetailRecordId(card.recordId)
                                setDetailGroupId(card.groupId)
                              }}
                            >
                              <div className="inhouse-record-main">
                                <span className="inhouse-record-chart-icon" aria-hidden="true" />
                                <div className="inhouse-record-text">
                                  <strong>{`${card.startAt.split(' ')[0] ?? card.startAt} - ${card.title}`}</strong>
                                  <p className="inhouse-record-winner-summary">{card.groupLabel} 상세 대진표</p>
                                </div>
                              </div>
                              <span className="inhouse-record-chevron" aria-hidden="true">
                                {isOpen ? '▴' : '▾'}
                              </span>
                            </button>

                            {isOpen && detailRecord && detailGroup && (
                              <div className="inhouse-record-expand">
                                <section className="bracket-group-card">
                                  <h4 className="bracket-group-title">
                                    {detailRecord.startAt} / {detailGroup.label} 대진표 상세
                                  </h4>
                                  <div className="bracket-layout">
                                    <div className="bracket-left-column">
                                      <div className="bracket-semis">
                                        {semifinalMatches.map((match, matchIndex) => (
                                          <article key={match.matchId} className="bracket-round-card">
                                            <header className="bracket-round-header">
                                              <strong>{detailGroup.label} 4강 {matchIndex + 1}경기</strong>
                                              <span className="bracket-round-tools">{match.tournamentCode && <code>{match.tournamentCode}</code>}</span>
                                            </header>
                                            <div className="bracket-round-body">
                                              <div
                                                className={`bracket-team-button is-finalist ${
                                                  getSemiWinnerDisplay(match) === match.teamANumber ? 'is-winner' : ''
                                                }`}
                                              >
                                                <span className="bracket-team-name">{match.teamANumber ? `${match.teamANumber}팀` : '대기'}</span>
                                              </div>
                                              <div className="bracket-round-vs">VS</div>
                                              <div
                                                className={`bracket-team-button is-finalist ${
                                                  getSemiWinnerDisplay(match) === match.teamBNumber ? 'is-winner' : ''
                                                }`}
                                              >
                                                <span className="bracket-team-name">{match.teamBNumber ? `${match.teamBNumber}팀` : '대기'}</span>
                                              </div>
                                            </div>
                                            <div className="bracket-match-actions">
                                              {isAdminSession && (
                                                <button
                                                  type="button"
                                                  className="bracket-match-action-button"
                                                  onClick={() =>
                                                    openMatchResultInputModal(
                                                      toMatchStorageKey(match.matchId),
                                                      formatMatchupTitle(detailGroup.label, match.teamANumber, match.teamBNumber),
                                                    )
                                                  }
                                                >
                                                  결과입력
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                className="bracket-match-action-button"
                                                onClick={() =>
                                                  openMatchResultViewModal(
                                                    toMatchStorageKey(match.matchId),
                                                    formatMatchupTitle(detailGroup.label, match.teamANumber, match.teamBNumber),
                                                  )
                                                }
                                              >
                                                상세보기
                                              </button>
                                            </div>
                                          </article>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="bracket-right-column">
                                      <article className="bracket-round-card bracket-final-card">
                                        <header className="bracket-round-header">
                                          <strong>{detailGroup.label} 결승</strong>
                                          <span className="bracket-round-tools">{finalMatch?.tournamentCode && <code>{finalMatch.tournamentCode}</code>}</span>
                                        </header>
                                        <div className="bracket-round-body">
                                          <div
                                            className={`bracket-team-button is-finalist ${
                                              finalWinnerDisplay === finalistA ? 'is-winner' : ''
                                            }`}
                                          >
                                            <span className="bracket-team-name">{finalistA ? `${finalistA}팀` : '승자 대기'}</span>
                                          </div>
                                          <div className="bracket-round-vs">VS</div>
                                          <div
                                            className={`bracket-team-button is-finalist ${
                                              finalWinnerDisplay === finalistB ? 'is-winner' : ''
                                            }`}
                                          >
                                            <span className="bracket-team-name">{finalistB ? `${finalistB}팀` : '승자 대기'}</span>
                                          </div>
                                        </div>
                                        <div className="bracket-match-actions">
                                          {isAdminSession && (
                                            <button
                                              type="button"
                                              className="bracket-match-action-button"
                                              onClick={() =>
                                                openMatchResultInputModal(
                                                  toMatchStorageKey(finalMatchId),
                                                  formatMatchupTitle(detailGroup.label, finalistA, finalistB),
                                                )
                                              }
                                            >
                                              결과입력
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="bracket-match-action-button"
                                            onClick={() =>
                                              openMatchResultViewModal(
                                                toMatchStorageKey(finalMatchId),
                                                formatMatchupTitle(detailGroup.label, finalistA, finalistB),
                                              )
                                            }
                                          >
                                            상세보기
                                          </button>
                                        </div>
                                      </article>

                                      <article className="bracket-round-card">
                                        <header className="bracket-round-header">
                                          <strong>{detailGroup.label} 패자조(3·4위전)</strong>
                                          <span className="bracket-round-tools">{lowerMatch?.tournamentCode && <code>{lowerMatch.tournamentCode}</code>}</span>
                                        </header>
                                        <div className="bracket-round-body">
                                          <div
                                            className={`bracket-team-button is-finalist ${
                                              lowerWinnerDisplay === lowerA ? 'is-winner' : ''
                                            }`}
                                          >
                                            <span className="bracket-team-name">{lowerA ? `${lowerA}팀` : '패자 대기'}</span>
                                          </div>
                                          <div className="bracket-round-vs">VS</div>
                                          <div
                                            className={`bracket-team-button is-finalist ${
                                              lowerWinnerDisplay === lowerB ? 'is-winner' : ''
                                            }`}
                                          >
                                            <span className="bracket-team-name">{lowerB ? `${lowerB}팀` : '패자 대기'}</span>
                                          </div>
                                        </div>
                                        <div className="bracket-match-actions">
                                          {isAdminSession && (
                                            <button
                                              type="button"
                                              className="bracket-match-action-button"
                                              onClick={() =>
                                                openMatchResultInputModal(
                                                  toMatchStorageKey(lowerMatchId),
                                                  formatMatchupTitle(detailGroup.label, lowerA, lowerB),
                                                )
                                              }
                                            >
                                              결과입력
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="bracket-match-action-button"
                                            onClick={() =>
                                              openMatchResultViewModal(
                                                toMatchStorageKey(lowerMatchId),
                                                formatMatchupTitle(detailGroup.label, lowerA, lowerB),
                                              )
                                            }
                                          >
                                            상세보기
                                          </button>
                                        </div>
                                      </article>
                                    </div>

                                  </div>
                                </section>
                              </div>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  )
                ) : filteredBracketRecords.length === 0 ? (
                  <p className="panel-empty">저장된 내전 대진 정보가 없습니다.</p>
                ) : (
                  <div className="inhouse-card-list">
                    {filteredBracketRecords.map((record) => (
                      <article
                        key={record.id}
                        className={`inhouse-created-card inhouse-record-card ${expandedRecordId === record.id ? 'is-open' : ''}`}
                      >
                        <button
                          type="button"
                          className="inhouse-record-toggle"
                          onClick={() => {
                            setExpandedRecordId((prev) => (prev === record.id ? '' : record.id))
                            if (expandedRecordId === record.id) {
                              setDetailRecordId('')
                              setDetailGroupId('')
                            }
                          }}
                        >
                          <div className="inhouse-record-main">
                            <span className="inhouse-record-chart-icon" aria-hidden="true" />
                            <div className="inhouse-record-text">
                              <strong>{`${record.startAt.split(' ')[0] ?? record.startAt} - ${record.title}`}</strong>
                              <p className="inhouse-record-winner-summary">
                                {record.groups.length === 0
                                  ? '우승팀 정보 없음'
                                  : record.groups
                                      .map((group) => `${group.label} 우승팀: ${group.placement.firstTeamNumber ? `${group.placement.firstTeamNumber}팀` : '-'}`)
                                      .join(' / ')}
                              </p>
                            </div>
                          </div>
                          <span className="inhouse-record-chevron" aria-hidden="true">
                            {expandedRecordId === record.id ? '▴' : '▾'}
                          </span>
                        </button>
                        {expandedRecordId === record.id && (
                          <div className="inhouse-record-expand">
                            <div className="record-detail-groups">
                              {record.groups.map((group) => {
                                const findTeam = (teamNumber: number | null) =>
                                  teamNumber ? group.teams.find((team) => team.teamNumber === teamNumber) ?? null : null
                                const rankCards = [
                                  { key: 'first', label: '🥇 우승', team: findTeam(group.placement.firstTeamNumber), theme: 'is-first' },
                                  { key: 'second', label: '🥈 준우승', team: findTeam(group.placement.secondTeamNumber), theme: 'is-second' },
                                  { key: 'third', label: '🥉 3위', team: findTeam(group.placement.thirdTeamNumber), theme: 'is-third' },
                                  { key: 'fourth', label: '4위', team: findTeam(group.placement.fourthTeamNumber), theme: 'is-fourth' },
                                ] as const
                                return (
                                  <Fragment key={`${record.id}-${group.groupId}`}>
                                    <section className="record-detail-group">
                                      <h4 className="record-detail-group-title">🏆 {group.label} 최종 결과 🏆</h4>
                                      <div className="record-detail-grid">
                                        {rankCards.map((card) => (
                                          <article key={`${group.groupId}-${card.key}`} className={`record-rank-card ${card.theme}`}>
                                            <header className="record-rank-card-head">
                                              <strong>{card.label}</strong>
                                              <span>{card.team ? `${card.team.teamNumber}팀` : '-'}</span>
                                            </header>
                                            <div className="record-rank-member-list">
                                              {card.team && card.team.members.length > 0 ? (
                                                card.team.members.map((member) => (
                                                  <button
                                                    key={`${group.groupId}-${card.key}-${member.riotId}`}
                                                    type="button"
                                                    className="record-rank-member-button"
                                                    onClick={() => handleOpenRecordFromStats(member.riotId)}
                                                  >
                                                    <span>{member.riotId}</span>
                                                    <strong>
                                                      {member.highestTier !== '-'
                                                        ? formatHighestTierChipText(member.highestTier)
                                                        : formatHighestTierChipText(getSignupSeasonPeakTierFromRiotId(member.riotId))}
                                                    </strong>
                                                  </button>
                                                ))
                                              ) : (
                                                <p className="is-empty">팀 정보 없음</p>
                                              )}
                                            </div>
                                          </article>
                                        ))}
                                      </div>
                                    </section>
                                    <button
                                      type="button"
                                      className="record-detail-separator"
                                      onClick={() => {
                                        setRecordCategoryFilter('detail-record')
                                        setDetailRecordId(record.id)
                                        setDetailGroupId(group.groupId)
                                      }}
                                    >
                                      상세 기록
                                    </button>
                                  </Fragment>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}

              </article>
            </section>
          </section>
        )}

        {!isLoginPage && !isUserInfoPage && isAdminSession && activeMenu === '관리' && (
          <section className="record-page inhouse-page admin-page">
            <header className="record-headline">
              <h2>관리 페이지</h2>
              <p>가입 유저의 승인 상태를 관리합니다.</p>
            </header>

            <section className="inhouse-layout admin-layout">
              <aside className="inhouse-category-sidebar admin-sidebar" aria-label="관리 카테고리">
                <h3>관리</h3>
                <div className="inhouse-category-list">
                  <button
                    type="button"
                    className={adminCategory === '유저관리' ? 'is-active' : ''}
                    onClick={() => setAdminCategory('유저관리')}
                  >
                    <span>유저관리</span>
                  </button>
                  <button
                    type="button"
                    className={adminCategory === '가입승인' ? 'is-active' : ''}
                    onClick={() => setAdminCategory('가입승인')}
                  >
                    <span>가입승인</span>
                    {pendingProfiles.length > 0 && (
                      <span className="admin-category-badge" aria-label={`가입 대기 ${pendingProfiles.length}명`}>
                        {pendingProfiles.length}
                      </span>
                    )}
                  </button>
                </div>
              </aside>

              <article className="inhouse-content-panel admin-panel">
                {adminCategory === '가입승인' && (
                  <>
                    {pendingProfiles.length === 0 && <p className="panel-empty">승인 대기중인 유저가 없습니다.</p>}
                    {pendingProfiles.map((profile) => (
                      <div className="admin-user-row" key={`${profile.riotId}-${profile.accountLabel}`}>
                        <div className="admin-user-main">
                          <div className="admin-user-avatar">
                            {profileIconByRiotId[profile.riotId] ? (
                              <img
                                src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${profileIconByRiotId[profile.riotId]}.png`}
                                alt=""
                              />
                            ) : (
                              <span>{profile.accountLabel.slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="admin-user-meta admin-user-meta-compact">
                            <strong>{profile.accountLabel}</strong>
                            <p className="admin-user-line">
                              <span>디스코드: {profile.discordId}</span>
                              <span>롤: {profile.riotId}</span>
                            </p>
                            <p className="admin-user-line">
                              <span>최고티어: {profile.seasonPeakTier}</span>
                              <span>주라인: {profile.mainLine || '-'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="admin-user-actions admin-user-actions-inline">
                          <button
                            type="button"
                            className="record-action-button"
                            onClick={() => handleUpdateUserApproval(profile.riotId, 'approved')}
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            className="admin-reject-button"
                            onClick={() => handleDeleteUser(profile.riotId)}
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {adminCategory === '유저관리' && (
                  <>
                    <div className="admin-type-filter" role="tablist" aria-label="유저 종류 필터">
                      {(['전체', '관리자', '운영진', '일반'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={userTypeFilter === type ? 'is-active' : ''}
                          onClick={() => setUserTypeFilter(type)}
                        >
                          <span>{type}</span>
                          <span className="admin-type-count">{userTypeCounts[type]}명</span>
                        </button>
                      ))}
                    </div>
                    <p className="admin-type-summary">
                      
                    </p>

                    {shouldShowAdminCard && (
                      <div className="admin-user-row">
                        <div className="admin-user-main">
                          <div className="admin-user-avatar">
                            <span>A</span>
                          </div>
                          <div className="admin-user-meta admin-user-meta-compact">
                            <div className="admin-user-title-row">
                              <strong>{adminProfileData.accountLabel}</strong>
                              <span className="admin-role-badge is-admin">관리자</span>
                            </div>
                            <p className="admin-user-line">
                              <span>디스코드: {adminProfileData.discordId}</span>
                              <span>롤: {adminProfileData.riotId}</span>
                            </p>
                            <p className="admin-user-line">
                              <span>최고티어: {adminProfileData.seasonPeakTier}</span>
                              <span>주라인: {adminProfileData.mainLine || '-'}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {filteredApprovedProfiles.length === 0 && !shouldShowAdminCard && (
                      <p className="panel-empty">해당 유형의 유저가 없습니다.</p>
                    )}

                    {filteredApprovedProfiles.map((profile) => (
                      <div className="admin-user-row" key={`${profile.riotId}-${profile.accountLabel}`}>
                        <div className="admin-user-main">
                          <div className="admin-user-avatar">
                            {profileIconByRiotId[profile.riotId] ? (
                              <img
                                src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${profileIconByRiotId[profile.riotId]}.png`}
                                alt=""
                              />
                            ) : (
                              <span>{profile.accountLabel.slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="admin-user-meta admin-user-meta-compact">
                            <div className="admin-user-title-row">
                              <strong>{profile.accountLabel}</strong>
                              <span
                                className={
                                  profile.userType === '운영진'
                                    ? 'admin-role-badge is-staff'
                                    : 'admin-role-badge is-normal'
                                }
                              >
                                {profile.userType}
                              </span>
                            </div>
                            <p className="admin-user-line">
                              <span>디스코드: {profile.discordId}</span>
                              <span>롤: {profile.riotId}</span>
                            </p>
                            <p className="admin-user-line">
                              <span>최고티어: {profile.seasonPeakTier}</span>
                              <span>주라인: {profile.mainLine || '-'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="admin-user-actions">
                          <button
                            type="button"
                            className="record-action-button"
                            onClick={() => openAdminEditModal(profile)}
                          >
                            변경
                          </button>
                          <button
                            type="button"
                            className="admin-delete-button"
                            onClick={() => handleDeleteUser(profile.riotId)}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </article>
            </section>
          </section>
        )}

        {isNoticeModalOpen && !isLoginPage && !isUserInfoPage && currentUserLabel.trim() && (
          <section
            className="edit-modal-backdrop notice-modal-backdrop"
            aria-label="공지사항"
            onClick={() => setIsNoticeModalOpen(false)}
          >
            <article className="login-card notice-modal-card" onClick={(event) => event.stopPropagation()}>
              <header className="notice-modal-head">
                <h3>공지사항</h3>
                <button type="button" className="notice-modal-close" onClick={() => setIsNoticeModalOpen(false)}>
                  ×
                </button>
              </header>

              <div className="notice-list">
                {sortedNoticeItems.length === 0 ? (
                  <p className="panel-empty">등록된 공지사항이 없습니다.</p>
                ) : (
                  sortedNoticeItems.map((notice) => (
                    <article key={notice.id} className="notice-card">
                      <button
                        type="button"
                        className={`notice-card-title ${selectedNotice?.id === notice.id ? 'is-active' : ''}`}
                        onClick={() => setSelectedNoticeId(notice.id)}
                      >
                        {notice.title}
                      </button>
                      {isAdminSession && (
                        <button
                          type="button"
                          className="notice-delete-button"
                          onClick={() => handleDeleteNotice(notice.id)}
                        >
                          삭제
                        </button>
                      )}
                    </article>
                  ))
                )}
              </div>

              <section className="notice-detail">
                {selectedNotice ? (
                  <>
                    <h4>{selectedNotice.title}</h4>
                    <p className="notice-detail-meta">
                      {formatNoticeDate(selectedNotice.createdAt)} · {selectedNotice.authorLabel}
                    </p>
                    <p className="notice-detail-content">{selectedNotice.content}</p>
                  </>
                ) : (
                  <p className="panel-empty">공지사항 제목을 선택하면 상세 내용이 표시됩니다.</p>
                )}
              </section>

              {isAdminSession && (
                <section className="notice-admin-form">
                  <input
                    value={noticeTitleInput}
                    onChange={(event) => setNoticeTitleInput(event.target.value)}
                    className="login-input"
                    placeholder="공지사항 제목"
                  />
                  <textarea
                    value={noticeContentInput}
                    onChange={(event) => setNoticeContentInput(event.target.value)}
                    className="notice-textarea"
                    placeholder="공지사항 내용"
                  />
                  {noticeFeedback && <p className="auth-feedback is-success">{noticeFeedback}</p>}
                  <button type="button" className="login-submit-button" onClick={handleCreateNotice}>
                    공지하기
                  </button>
                </section>
              )}
            </article>
          </section>
        )}

        {isEditModalOpen && isAdminSession && (
          <section className="edit-modal-backdrop" aria-label="유저 정보 변경">
            <article className="login-card edit-modal-card">
              <header className="login-header">
                <h2>유저 정보</h2>
              </header>
              <div className="user-info-list">
                <p>
                  <strong>계정</strong>
                  <input
                    value={editAccountLabel}
                    onChange={(event) => setEditAccountLabel(event.target.value)}
                    className="user-info-input"
                  />
                </p>
                <p>
                  <strong>디스코드</strong>
                  <input
                    value={editDiscordId}
                    onChange={(event) => setEditDiscordId(event.target.value)}
                    className="user-info-input"
                  />
                </p>
                <p>
                  <strong>롤 아이디#태그</strong>
                  <input
                    value={editRiotId}
                    onChange={(event) => setEditRiotId(event.target.value)}
                    className="user-info-input"
                  />
                </p>
                <p>
                  <strong>시즌-최고티어</strong>
                  <div className="tier-field-row">
                    <select
                      value={editSeason}
                      onChange={(event) => setEditSeason(event.target.value)}
                      className="user-info-select"
                    >
                      <option value="">시즌 선택</option>
                      {SEASON_OPTIONS.map((season) => (
                        <option key={season} value={season}>
                          {season}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editTier}
                      onChange={(event) => setEditTier(event.target.value)}
                      className="user-info-select"
                    >
                      <option value="">티어 선택</option>
                      {TIER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {findTierOption(editTier)?.requiresLp && (
                      <input
                        value={editLp}
                        onChange={(event) => setEditLp(event.target.value.replace(/\D/g, ''))}
                        className="user-info-input tier-lp-input"
                        inputMode="numeric"
                        placeholder="LP"
                      />
                    )}
                  </div>
                </p>
                <p>
                  <strong>주라인</strong>
                  <select
                    value={editMainLine}
                    onChange={(event) => setEditMainLine(event.target.value)}
                    className="user-info-select"
                  >
                    <option value="">선택</option>
                    <option value="TOP">TOP</option>
                    <option value="JUNGLE">JUNGLE</option>
                    <option value="MID">MID</option>
                    <option value="ADC">ADC</option>
                    <option value="SUP">SUP</option>
                  </select>
                </p>
                <p>
                  <strong>유저종류</strong>
                  <select
                    value={editUserType}
                    onChange={(event) => setEditUserType(event.target.value as '운영진' | '일반')}
                    className="user-info-select"
                  >
                    <option value="일반">일반</option>
                    <option value="운영진">운영진</option>
                  </select>
                </p>
                <p>
                  <strong>승인상태</strong>
                  <span className="user-info-value">{editApprovalStatus === 'approved' ? '승인완료' : '승인대기'}</span>
                </p>
              </div>
              {editFeedback && (
                <p className={editFeedbackType === 'error' ? 'auth-feedback is-error' : 'auth-feedback is-success'}>
                  {editFeedback}
                </p>
              )}
              <div className="user-info-actions">
                <button type="button" className="login-submit-button" onClick={handleSaveAdminEdit}>
                  저장
                </button>
                <button type="button" className="signup-button" onClick={() => setIsEditModalOpen(false)}>
                  취소
                </button>
              </div>
            </article>
          </section>
        )}

        {isMatchDetailModalOpen && (
          <section
            className="edit-modal-backdrop match-detail-modal-backdrop"
            aria-label="매치 상세 조회"
            onClick={() => {
              setIsMatchDetailModalOpen(false)
              setMatchDetailLoading(false)
              setMatchDetailError('')
            }}
          >
            <article
              className={`login-card match-detail-modal-card ${matchDetailModalMode === 'input' ? 'is-input' : ''}`}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="login-header match-detail-modal-head">
                {matchDetailModalMode === 'input' ? (
                  <div>
                    <h2>매치 아이디 입력</h2>
                    {matchDetailTitle && <p className="match-detail-modal-subtitle">{matchDetailTitle}</p>}
                  </div>
                ) : (
                  <div className="match-detail-game-headline">
                    <strong>Game 1</strong>
                    <span>{matchDetailTitle || '상세보기'}</span>
                  </div>
                )}
                {matchDetailModalMode === 'view' && (
                  <button
                    type="button"
                    className="match-detail-close-button"
                    aria-label="닫기"
                    onClick={() => {
                      setIsMatchDetailModalOpen(false)
                      setMatchDetailLoading(false)
                      setMatchDetailError('')
                    }}
                  >
                    ×
                  </button>
                )}
              </header>

              {matchDetailModalMode === 'input' && (
                <>
                  <div className="match-detail-input-row">
                    <input
                      value={matchDetailInput}
                      onChange={(event) => setMatchDetailInput(event.target.value)}
                      className="login-input"
                      placeholder="예: KR_1234567890"
                      disabled={matchDetailLoading}
                    />
                  </div>
                  <div className="match-detail-input-actions">
                    <button
                      type="button"
                      className="login-submit-button"
                      onClick={() => void handleSaveMatchDetailId()}
                      disabled={matchDetailLoading}
                    >
                      {matchDetailLoading ? '저장중' : '저장'}
                    </button>
                    <button
                      type="button"
                      className="signup-button"
                      onClick={() => {
                        setIsMatchDetailModalOpen(false)
                        setMatchDetailLoading(false)
                        setMatchDetailError('')
                      }}
                    >
                      취소
                    </button>
                  </div>
                </>
              )}

              {matchDetailError && <p className="auth-feedback is-error">{matchDetailError}</p>}

              {matchDetailModalMode === 'view' && matchDetailData && (
                <section className="match-detail-board">
                  <header className="match-detail-board-head">
                    <span className="match-detail-game-duration">게임시간 {formatSecondsToMinuteText(matchDetailData.gameDuration)}</span>
                  </header>

                  <div className="match-detail-table-wrap">
                    {[...matchDetailData.teams]
                      .sort((a, b) => Number(b.win) - Number(a.win))
                      .map((team, teamIndex, orderedTeams) => {
                      const teamLabel = `${teamIndex + 1}팀`
                      const teamKills = team.participants.reduce((sum, participant) => sum + participant.kills, 0)
                      const teamMaxDamage = Math.max(
                        1,
                        ...team.participants.map((participant) => participant.totalDamageDealtToChampions),
                      )
                      const bestOpScore = team.participants.reduce((max, participant) => {
                        const kp = teamKills > 0 ? ((participant.kills + participant.assists) / teamKills) * 100 : 0
                        const kdaRatio = participant.deaths === 0
                          ? participant.kills + participant.assists
                          : (participant.kills + participant.assists) / participant.deaths
                        const opScore = Number((kdaRatio + kp / 25 + participant.visionScore / 20).toFixed(1))
                        return Math.max(max, opScore)
                      }, 0)
                      return (
                        <Fragment key={`${matchDetailData.matchId}-${team.teamId}`}>
                          <article className="match-detail-team-table">
                            <header className={`match-detail-team-banner ${team.win ? 'is-win' : 'is-lose'}`}>
                              <strong>
                                {team.win ? '승리' : '패배'} ({teamLabel})
                              </strong>
                              <span>{teamKills} KILL</span>
                            </header>
                            <div className="match-detail-column-header">
                              <span>플레이어</span>
                              <span>OP Score</span>
                              <span>KDA</span>
                              <span>피해량</span>
                              <span>와드</span>
                              <span>CS</span>
                              <span>아이템</span>
                            </div>
                            <div className="match-detail-row-list">
                              {team.participants.map((participant) => {
                                const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled
                                const kp = teamKills > 0 ? Math.round(((participant.kills + participant.assists) / teamKills) * 100) : 0
                                const kdaRatio = participant.deaths === 0
                                  ? participant.kills + participant.assists
                                  : (participant.kills + participant.assists) / participant.deaths
                                const opScore = Number((kdaRatio + kp / 25 + participant.visionScore / 20).toFixed(1))
                                const itemIcons = participant.items.map((itemId) => getItemIconUrl(itemId))
                                const damageRatio = Math.max(
                                  6,
                                  Math.round((participant.totalDamageDealtToChampions / teamMaxDamage) * 100),
                                )
                                const isBestScore = opScore === bestOpScore
                                const spells = participant.summonerSpellIds
                                  .map((spellId) => summonerSpellIconById[spellId] ?? '')
                                  .filter((url) => url !== '')
                                const primaryRuneIcon = participant.primaryRuneId
                                  ? (perkIconById[participant.primaryRuneId] ?? '')
                                  : ''
                                return (
                                  <article key={participant.puuid} className="match-detail-table-row">
                                    <div className="match-detail-player-main">
                                      <img
                                        src={getChampionIconUrl(participant.championName)}
                                        alt={participant.championName}
                                        className="match-detail-champion-icon"
                                      />
                                      <div className="match-detail-spell-stack">
                                        {spells.slice(0, 2).map((iconUrl, iconIndex) => (
                                          <img
                                            key={`${participant.puuid}-spell-${iconIndex}`}
                                            src={iconUrl}
                                            alt={`spell-${iconIndex}`}
                                            className="match-detail-spell-icon"
                                          />
                                        ))}
                                        {spells.length < 2 && <span className="match-detail-spell-empty" />}
                                      </div>
                                      {primaryRuneIcon ? (
                                        <img src={primaryRuneIcon} alt="primary-rune" className="match-detail-rune-icon" />
                                      ) : (
                                        <span className="match-detail-rune-empty" />
                                      )}
                                      <div className="match-detail-player-idbox">
                                        <strong>{participant.riotId || participant.summonerName}</strong>
                                        <span>{participant.championName}</span>
                                      </div>
                                      <span className="match-detail-level">Lv.{participant.championLevel}</span>
                                    </div>

                                    <div className="match-detail-cell-score">
                                      <strong>{opScore.toFixed(1)}</strong>
                                      {isBestScore && <span className={team.win ? 'is-mvp' : 'is-ace'}>{team.win ? 'MVP' : 'ACE'}</span>}
                                    </div>

                                    <div className="match-detail-kda-box">
                                      <strong>
                                        {participant.kills} / {participant.deaths} / {participant.assists}
                                      </strong>
                                      <span>
                                        <span className={`match-detail-kda-value ${getKdaTierClass(kdaRatio)}`}>
                                          {formatKdaRatioText(participant.kills, participant.deaths, participant.assists)}
                                        </span>{' '}
                                        ({kp}%)
                                      </span>
                                    </div>

                                    <div className="match-detail-damage-box">
                                      <strong>{participant.totalDamageDealtToChampions.toLocaleString()}</strong>
                                      <div className="match-detail-damage-track">
                                        <span
                                          className={`match-detail-damage-fill ${team.win ? 'is-win' : 'is-lose'}`}
                                          style={{ width: `${damageRatio}%` }}
                                        />
                                      </div>
                                    </div>

                                    <div className="match-detail-ward-box">
                                      <strong>
                                        {participant.visionScore} / {participant.wardsPlaced}
                                      </strong>
                                      <span>{participant.detectorWardsPlaced}</span>
                                    </div>

                                    <div className="match-detail-cs-box">
                                      <strong>{cs}</strong>
                                      <span>분당 {formatPerMinuteText(cs, matchDetailData.gameDuration)}</span>
                                    </div>

                                    <div className="match-detail-item-box">
                                      <div className="match-detail-item-row">
                                        {itemIcons.map((iconUrl, index) =>
                                          iconUrl ? (
                                            <img
                                              key={`${participant.puuid}-item-${index}`}
                                              src={iconUrl}
                                              alt={`item-${index}`}
                                              className="match-detail-item-icon"
                                            />
                                          ) : (
                                            <span key={`${participant.puuid}-item-${index}`} className="match-detail-item-empty" />
                                          ),
                                        )}
                                      </div>
                                    </div>

                                  </article>
                                )
                              })}
                            </div>
                          </article>
                          {teamIndex === 0 && orderedTeams[1] && (
                            <div className="match-detail-total-kill-bar">
                              <span>{teamKills}</span>
                              <strong>TOTAL KILL</strong>
                              <span>{orderedTeams[1].participants.reduce((sum, participant) => sum + participant.kills, 0)}</span>
                            </div>
                          )}
                        </Fragment>
                      )
                    })}
                  </div>
                </section>
              )}

              {matchDetailModalMode === 'view' && (
                <div className="login-actions">
                  {!matchDetailData && !matchDetailLoading && !matchDetailError && (
                    <p className="match-detail-modal-empty">저장된 매치 아이디로 결과를 불러오지 못했습니다.</p>
                  )}
                </div>
              )}
            </article>
          </section>
        )}

        {isInhouseCreateModalOpen && isAdminSession && (
          <section className="edit-modal-backdrop" aria-label="내전 생성">
            <article className="login-card inhouse-create-modal-card">
              <header className="login-header">
                <h2>내전 생성</h2>
              </header>

              <div className="login-field-group">
                <label htmlFor="inhouse-create-title">제목</label>
                <input
                  id="inhouse-create-title"
                  value={inhouseCreateTitle}
                  onChange={(event) => setInhouseCreateTitle(event.target.value)}
                  className="login-input"
                  placeholder="예: 금요일 내전 5:5"
                />
              </div>

              <div className="login-field-group">
                <label htmlFor="inhouse-create-start-time">시작 시간</label>
                <input
                  id="inhouse-create-start-time"
                  value={inhouseCreateStartAt}
                  onChange={(event) => setInhouseCreateStartAt(event.target.value)}
                  className="login-input"
                  placeholder="예: 2026. 03. 23. 오후 12:30"
                />
              </div>

              <div className="login-actions">
                <button
                  type="button"
                  className="login-submit-button"
                  onClick={handleCreateInhouseCard}
                >
                  생성
                </button>
                <button
                  type="button"
                  className="signup-button"
                  onClick={() => {
                    setInhouseCreateFeedback('')
                    setIsInhouseCreateModalOpen(false)
                  }}
                >
                  취소
                </button>
              </div>
              {inhouseCreateFeedback && <p className="auth-feedback is-error">{inhouseCreateFeedback}</p>}
            </article>
          </section>
        )}

        {isInhouseApplyModalOpen && (
          <section className="edit-modal-backdrop" aria-label="신청 상태 선택">
            <article className="login-card inhouse-apply-modal-card">
              <header className="login-header">
                <h2>신청 상태 선택</h2>
              </header>
              <div className="inhouse-apply-status-actions">
                <button
                  type="button"
                  className="login-submit-button"
                  onClick={() => handleSelectInhouseApplyStatus('applied')}
                >
                  신청
                </button>
                <button
                  type="button"
                  className="signup-button inhouse-wait-button"
                  onClick={() => handleSelectInhouseApplyStatus('waiting')}
                >
                  대기
                </button>
              </div>
              <button
                type="button"
                className="signup-button"
                onClick={() => {
                  setIsInhouseApplyModalOpen(false)
                  setInhouseApplyTargetCardId('')
                }}
              >
                취소
              </button>
            </article>
          </section>
        )}

        {isInhouseEditModalOpen && isAdminSession && (
          <section className="edit-modal-backdrop" aria-label="내전 수정">
            <article className="login-card inhouse-create-modal-card">
              <header className="login-header">
                <h2>내전 수정</h2>
              </header>

              <div className="login-field-group">
                <label htmlFor="inhouse-edit-title">제목</label>
                <input
                  id="inhouse-edit-title"
                  value={inhouseEditTitle}
                  onChange={(event) => setInhouseEditTitle(event.target.value)}
                  className="login-input"
                />
              </div>

              <div className="login-field-group">
                <label htmlFor="inhouse-edit-start-time">시작 시간</label>
                <input
                  id="inhouse-edit-start-time"
                  value={inhouseEditStartAt}
                  onChange={(event) => setInhouseEditStartAt(event.target.value)}
                  className="login-input"
                  placeholder="예: 2026. 03. 23. 오후 12:30"
                />
              </div>

              <div className="inhouse-edit-actions">
                <button type="button" className="inhouse-modal-delete-button" onClick={handleDeleteInhouseFromEdit}>
                  삭제
                </button>
                <button type="button" className="login-submit-button" onClick={handleSaveInhouseEdit}>
                  확인
                </button>
              </div>
              <button
                type="button"
                className="signup-button"
                onClick={() => {
                  setInhouseEditFeedback('')
                  setIsInhouseEditModalOpen(false)
                }}
              >
                취소
              </button>
              {inhouseEditFeedback && <p className="auth-feedback is-error">{inhouseEditFeedback}</p>}
            </article>
          </section>
        )}

      </main>
    </div>
  )
}

export default App
