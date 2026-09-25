export type ViewName =
  | 'auth'
  | 'home'
  | 'store'
  | 'editor'
  | 'build'
  | 'console'
  | 'ready'
  | 'profile'
  | 'wallet'
  | 'payments'
  | 'subscription'
  | 'referrals'
  | 'notifications'
  | 'push'
  | 'appDownload'
  | 'adminPanel'
  | 'seller'
  | 'purchases'

export interface SessionUser {
  id: string
  name: string
  email: string
  wallet: number
  plan: string
  referralCode: string
  role: 'ADMIN' | 'USER'
  createdAt: string
}

export interface ProjectFileDTO {
  id: string
  path: string
  content: string
  language: string
  updatedAt: string
}

export interface ProjectDTO {
  id: string
  name: string
  type: 'blank' | 'webview' | 'html' | 'kotlin'
  createdAt: string
  updatedAt: string
  fileCount?: number
  files?: ProjectFileDTO[]
}

export interface BuildConfig {
  icon?: string
  splash?: string
  statusBarColor?: string
  hideTitleBar?: boolean
  loadingSpinner?: boolean
  fullscreen?: boolean
  exitConfirmation?: boolean
  pullToRefresh?: boolean
  pinchZoom?: boolean
  mediaAutoplay?: boolean
  autoPlayVideo?: boolean
  desktopMode?: boolean
  longPressMenu?: boolean
  cameraAccess?: boolean
  microphone?: boolean
  darkModeSupport?: boolean
  sharePhrase?: string
  shareLink?: string
  customCss?: string
  webhookUrl?: string
  pushNotifications?: boolean
}

export interface BuildDTO {
  id: string
  appName: string
  packageName: string
  versionName: string
  versionCode: number
  sourceType: 'html' | 'kotlin'
  sourceMode: string
  websiteUrl?: string | null
  status: 'queued' | 'building' | 'success' | 'failed' | 'canceled'
  progress: number
  currentStep: string
  logs: string
  apkSize?: string | null
  error?: string | null
  provider?: 'local' | 'github' | string
  runUrl?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
}

export interface TemplateDTO {
  id: string
  title: string
  author: string
  authorInitials: string
  price: number
  category: string
  views: number
  downloads: number
  featured: boolean
  previewType: 'code' | 'dark' | 'gradient' | 'none'
  previewText?: string | null
  previewSub?: string | null
}

export interface PaymentDTO {
  id: string
  amount: number
  method: string
  senderNumber: string
  trxId: string
  status: string
  gateway: string
  gatewayUrl?: string | null
  verifiedAt?: string | null
  createdAt: string
}

export interface NotificationDTO {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

/* ---------------- Push Notifications (Website → built APKs) ---------------- */

export interface PushAppDTO {
  packageName: string
  appName: string
  devices: number
  lastBuiltAt: string
}

export interface PushItemDTO {
  id: string
  packageName: string
  title: string
  description: string
  imageUrl?: string | null
  html?: string | null
  delivered: number
  createdAt: string
}

export interface AppReleaseDTO {
  id: string
  versionName: string
  versionCode: number
  notes: string
  size: number
  downloads: number
  isActive: boolean
  createdAt: string
}

export interface StatsDTO {
  projects: number
  downloads: number
  wallet: number
  plan: string
}

export interface PlanDTO {
  id: string
  name: string
  description: string
  price: number
  priceYearly: number
  features: string
  accent: string
  isPopular: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/* ---------------- Marketplace types ---------------- */

export interface MarketplaceListingDTO {
  id: string
  title: string
  description: string
  price: number
  category: string
  tags: string
  previewType: string
  previewText: string | null
  previewSub: string | null
  status: 'active' | 'paused' | 'sold_out' | 'taken_down'
  salesCount: number
  views: number
  rating: number
  ratingCount: number
  projectId: string
  sellerId: string
  sellerName: string
  sellerInitials: string
  createdAt: string
  updatedAt: string
}

export interface MarketplacePurchaseDTO {
  id: string
  listingId: string
  listingTitle: string
  price: number
  discount: number
  finalPrice: number
  couponCode: string | null
  projectId: string
  projectName: string
  sellerId: string
  sellerName: string
  buyerId: string
  buyerName: string
  previewType?: string
  previewText?: string | null
  previewSub?: string | null
  createdAt: string
}

export interface CouponDTO {
  id: string
  code: string
  discountPercent: number
  maxUses: number
  usedCount: number
  expiresAt: string | null
  active: boolean
  listingId: string | null
  listingTitle: string | null
  sellerId: string
  sellerName: string
  createdAt: string
}
