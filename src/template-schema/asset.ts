/**
 * asset — types for user-uploaded image assets (advertisements, header
 * graphics, footer graphics, airline logos, etc).
 *
 * Assets live in IndexedDB; templates reference them via `asset://<id>`
 * URLs. The category is a soft hint that the picker uses to filter — it
 * does not gate where an asset can be placed.
 */

export const ASSET_CATEGORIES = [
  'advertisement',
  'header',
  'footer',
  'logo',
  'icon',
  'animation',
  'other',
] as const

export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  advertisement: 'Advertisement',
  header: 'Header',
  footer: 'Footer',
  logo: 'Logo',
  icon: 'Icon',
  animation: 'Animation',
  other: 'Other',
}

export interface AssetMeta {
  id: string
  name: string
  /** MIME type as reported by the File API at upload time. */
  mime: string
  /** Bytes. */
  size: number
  /** Decoded pixel dimensions; null if decode failed (non-image upload). */
  width: number | null
  height: number | null
  category: AssetCategory
  createdAt: number
}

/** asset:// URL helpers. The scheme is opaque to the browser — we
 *  resolve it ourselves in `useAssetUrl`. */
export const ASSET_URL_PREFIX = 'asset://'

export function isAssetUrl(src: string | undefined | null): src is string {
  return typeof src === 'string' && src.startsWith(ASSET_URL_PREFIX)
}

export function assetUrlFromId(id: string): string {
  return `${ASSET_URL_PREFIX}${id}`
}

export function assetIdFromUrl(url: string): string | null {
  if (!isAssetUrl(url)) return null
  return url.slice(ASSET_URL_PREFIX.length) || null
}
