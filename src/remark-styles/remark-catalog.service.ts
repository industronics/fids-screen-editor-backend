import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthRequest } from '@industronics/remote-auth'

/**
 * RemarkCatalogItem — the trimmed remark shape the editor needs to
 * drive the colour config grid. Sourced from flight-trips-api; `code`
 * is the 3-letter key pos_frontend renders against.
 */
export interface RemarkCatalogItem {
  code: string
  name: string
  category: string | null
}

interface CacheEntry {
  at: number
  items: RemarkCatalogItem[]
}

const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * RemarkCatalogService — server-to-server proxy + cache for
 * flight-trips-api's `/flight-remarks/getAll`. The editor talks only to
 * its own backend for this feature (one origin), and we cache per owner
 * because the catalog is per-airport, not per-user.
 *
 * Auth is a pass-through: we forward the caller's Authorization header
 * (present only in real-auth mode) plus `x-owner-id` derived from the
 * active scope, so flight-trips-api applies the same per-airport
 * scoping the browser would have triggered calling it directly.
 */
@Injectable()
export class RemarkCatalogService {
  private readonly logger = new Logger(RemarkCatalogService.name)
  private readonly cache = new Map<string, CacheEntry>()

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    const raw =
      this.config.get<string>('FLIGHT_TRIPS_API_URL') ?? 'http://localhost:9081'
    return raw.replace(/\/+$/, '')
  }

  async getCatalog(req: AuthRequest): Promise<RemarkCatalogItem[]> {
    const ownerKey = String(req.scope.ownerId)
    const hit = this.cache.get(ownerKey)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items

    const items = await this.fetchUpstream(req)
    this.cache.set(ownerKey, { at: Date.now(), items })
    return items
  }

  private async fetchUpstream(req: AuthRequest): Promise<RemarkCatalogItem[]> {
    const url = `${this.baseUrl()}/flight-remarks/getAll`
    const headers: Record<string, string> = {
      'x-owner-id': String(req.scope.ownerId),
    }
    const auth = req.headers?.authorization
    if (auth) headers.authorization = auth

    let res: Response
    try {
      res = await fetch(url, { headers })
    } catch (err) {
      this.logger.error(`flight-trips-api unreachable: ${(err as Error).message}`)
      throw new BadGatewayException('Remark catalog source unreachable')
    }
    if (!res.ok) {
      this.logger.error(`flight-trips-api /flight-remarks/getAll → ${res.status}`)
      throw new BadGatewayException(`Remark catalog source returned ${res.status}`)
    }
    return normalize(await res.json())
  }
}

/** flight-trips-api may return a bare array or a `{ data: [...] }`
 *  envelope (its getData wrapper) — accept either, drop codeless rows. */
function normalize(body: unknown): RemarkCatalogItem[] {
  const arr: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown[] })?.data)
      ? ((body as { data: unknown[] }).data)
      : []
  return arr
    .map((r) => {
      const rec = (r ?? {}) as Record<string, unknown>
      const code = String(rec.code ?? '').trim()
      return {
        code,
        name: String(rec.name ?? rec.code ?? '').trim(),
        category: rec.category != null ? String(rec.category) : null,
      }
    })
    .filter((r) => r.code.length > 0)
}
