export type UpdateState =
  | { status: 'available'; version: string; error?: string }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'downloaded'; version: string }
