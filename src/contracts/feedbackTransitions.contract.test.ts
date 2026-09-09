/**
 * ============================================================
 * HỢP ĐỒNG: LUẬT CHUYỂN TRẠNG THÁI PHẢN ÁNH (UI ↔ DATABASE)
 * ============================================================
 *
 * Bài kiểm thử này đọc TRỰC TIẾP file migration SQL và trích xuất luật chuyển
 * trạng thái từ trigger `community.validate_field_report_transition()`, rồi so
 * khớp với hằng số `FEEDBACK_TRANSITIONS` mà UI đang dùng.
 *
 * Mục đích: nếu ai đó sửa migration mà quên sửa UI (hoặc ngược lại), test sẽ
 * báo đỏ ngay thay vì để lỗi rơi xuống runtime dưới dạng PostgreSQL ERRCODE
 * 23514 khó truy vết.
 * ============================================================
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEEDBACK_TRANSITIONS, getFeedbackNextStatuses } from '@/constant/feedbackTransitions'
import type { FeedbackStatus } from '@/types/api'

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../server/src/database/migrations/023_field_reports.sql'
)

/**
 * Trích luật chuyển trạng thái từ mệnh đề IF NOT(...) của trigger.
 *
 * Dạng trong SQL:
 *   (OLD.status='pending' AND NEW.status IN('under_review','approved','rejected'))
 *   (OLD.status='approved' AND NEW.status='resolved')
 */
function parseTransitionsFromSql(sql: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  const pattern =
    /OLD\.status\s*=\s*'([a-z_]+)'\s*AND\s*NEW\.status\s*(?:IN\s*\(([^)]*)\)|=\s*'([a-z_]+)')/gi

  for (const match of sql.matchAll(pattern)) {
    const from = match[1]
    const inList = match[2]
    const single = match[3]

    const targets = inList
      ? Array.from(inList.matchAll(/'([a-z_]+)'/gi)).map((m) => m[1])
      : [single]

    result[from] = [...(result[from] ?? []), ...targets]
  }

  return result
}

describe('Feedback status transition contract (UI ↔ SQL trigger)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const sqlTransitions = parseTransitionsFromSql(sql)

  it('finds the transition rules inside the migration file', () => {
    expect(sql).toContain('validate_field_report_transition')
    expect(Object.keys(sqlTransitions).length).toBeGreaterThan(0)
  })

  it('matches every rule declared by the database trigger', () => {
    for (const [from, targets] of Object.entries(sqlTransitions)) {
      const uiTargets = FEEDBACK_TRANSITIONS[from as FeedbackStatus]
      expect(uiTargets, `UI thiếu định nghĩa cho trạng thái "${from}"`).toBeDefined()
      expect([...uiTargets].sort(), `Lệch luật chuyển tiếp từ "${from}"`).toEqual(
        [...targets].sort()
      )
    }
  })

  it('declares no transition the database would reject', () => {
    for (const [from, uiTargets] of Object.entries(FEEDBACK_TRANSITIONS)) {
      if (uiTargets.length === 0) continue
      const sqlTargets = sqlTransitions[from] ?? []
      for (const target of uiTargets) {
        expect(
          sqlTargets,
          `UI cho phép "${from}" → "${target}" nhưng trigger DB sẽ từ chối`
        ).toContain(target)
      }
    }
  })

  it('treats resolved and rejected as terminal states', () => {
    expect(FEEDBACK_TRANSITIONS.resolved).toEqual([])
    expect(FEEDBACK_TRANSITIONS.rejected).toEqual([])
    expect(getFeedbackNextStatuses('resolved')).toEqual([])
    expect(getFeedbackNextStatuses('rejected')).toEqual([])
  })

  it('never offers pending as a review target', () => {
    const everyStatus: FeedbackStatus[] = [
      'pending',
      'under_review',
      'approved',
      'rejected',
      'resolved',
    ]
    for (const status of everyStatus) {
      expect(getFeedbackNextStatuses(status)).not.toContain('pending')
      expect(getFeedbackNextStatuses(status, true)).not.toContain('pending')
    }
  })

  it('allows an override actor to pick any other review status', () => {
    expect([...getFeedbackNextStatuses('resolved', true)].sort()).toEqual([
      'approved',
      'rejected',
      'under_review',
    ])
  })
})
