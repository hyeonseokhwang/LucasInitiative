export interface CpuInfo {
  percent: number
  freq_mhz: number
  cores: number
  threads: number
}

export interface RamInfo {
  used_gb: number
  total_gb: number
  percent: number
}

export interface GpuInfo {
  name: string
  util_percent: number
  mem_used_mb: number
  mem_total_mb: number
  temp_c: number
  power_w: number
}

export interface OllamaInfo {
  running: boolean
  models_count: number
  loaded_models: string[]
}

export interface SystemSnapshot {
  cpu: CpuInfo
  ram: RamInfo
  gpu: GpuInfo
  disk: { used_gb: number; total_gb: number }
  ollama: OllamaInfo
  timestamp: string
}

export interface ChatMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  tokens_used?: number
  duration_ms?: number
  created_at: string
}

export interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface TaskItem {
  id: number
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  description: string
  model?: string
  output_summary?: string
  error?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export interface ModelInfo {
  name: string
  label: string
  category: string
  recommended: boolean
  note: string
  size: number
}

export interface ScheduleItem {
  id: number
  title: string
  description?: string
  start_at: string
  end_at?: string
  all_day: boolean
  category: string
  remind_at?: string
  status: string
  created_at: string
}

export interface ExpenseItem {
  id: number
  amount: number
  category: string
  description?: string
  is_income: boolean
  paid_at: string
  source: string
  created_at: string
}

export interface ExpenseSummary {
  month: string
  total_income: number
  total_expense: number
  balance: number
  breakdown: { category: string; is_income: boolean; total: number; count: number }[]
}

export interface ResearchReport {
  id: number
  topic_id: number
  title: string
  summary: string
  full_analysis: string
  confidence_avg: number
  agreement_rate: number
  contradictions: number
  evidence_count: number
  model_used?: string
  query?: string
  trigger_type?: string
  priority?: number
  category?: string
  bookmarked?: boolean | number
  created_at: string
}

export interface ResearchEvidence {
  id: number
  topic_id: number
  claim: string
  source: string
  source_type: string
  confidence: number
  agrees_with?: string
  contradicts?: string
  verified: boolean
  raw_data?: string
  created_at: string
}

export interface ResearchTopic {
  id: number
  title: string
  query: string
  priority: number
  status: string
  trigger_type: string
  category?: string
  source_data?: string
  created_at: string
  completed_at?: string
}

export type WsMessage =
  | { type: 'metrics'; data: SystemSnapshot }
  | { type: 'chat_token'; data: { conversation_id: number; token: string; done: boolean } }
  | { type: 'chat_complete'; data: { conversation_id: number; message_id: number; model: string; duration_ms: number; tokens: number } }
  | { type: 'task_update'; data: { id: number; status: string; task_type?: string; description?: string } }
  | { type: 'agent_update'; data: { id: string; status: string; current_task: string; last_report?: string; task_count?: number } }
  | { type: 'collector_alert'; data: { category: string; message: string; count: number } }
  | { type: 'collector_update'; data: { category: string; new_items: number } }
  | { type: 'daily_report'; data: { title: string; preview: string } }
  | { type: 'research_update'; data: { topic_id: number; title: string; stage: string; status: string } }
  | { type: 'research_complete'; data: { topic_id: number; report_id: number; title: string; summary: string; confidence: number; evidence_count: number } }
  | { type: 'pong' }
