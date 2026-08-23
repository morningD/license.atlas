#!/bin/bash
# Event-triggered tracker update: probe the OSI license-review archive,
# and only when it changed, run the full update pipeline via opencode.
#
# Exit codes follow the probe script (0 = no change, 3 = updated, 2 = probe error).

set -u
# Resolve locations. Direct repo runs derive ATLAS_DIR from this script's
# path; the launchd runner (~/.local/share/license-atlas-tracker) exports
# ATLAS_DIR / TRACKER_LOG_DIR / TRACKER_PROBE_SCRIPT overrides instead,
# keeping its logs and probe state outside Documents (macOS TCC).
ATLAS_DIR="${ATLAS_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG_DIR="${TRACKER_LOG_DIR:-$ATLAS_DIR/logs}"
PROBE_SCRIPT="${TRACKER_PROBE_SCRIPT:-$ATLAS_DIR/scripts/check-tracker-updates.mjs}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/auto-update-$(date +%Y%m%d).log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

# Guard: skip if another instance is still running.
LOCK_FILE="$LOG_DIR/auto-update.lock"
if [[ -f "$LOCK_FILE" ]] && kill -0 "$(cat "$LOCK_FILE" 2>/dev/null)" 2>/dev/null; then
  log "another update is running (pid $(cat "$LOCK_FILE")), skipping"
  exit 0
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

log "=== probe start ==="
probe_rc=2
for attempt in 1 2 3; do
  node "$PROBE_SCRIPT" >> "$LOG" 2>&1
  probe_rc=$?
  if [[ $probe_rc -ne 2 ]]; then break; fi
  # Probe errors are usually transient (wake-up network not ready). Retry
  # shortly instead of waiting a full launchd cycle (which macOS may defer
  # indefinitely across sleep).
  log "probe error (rc=2, attempt $attempt/3), retrying in 60s"
  sleep 60
done

if [[ $probe_rc -eq 0 ]]; then
  log "no archive change, short-circuit"
  exit 0
elif [[ $probe_rc -ne 3 ]]; then
  log "probe error persisted after retries (rc=$probe_rc), will retry next cycle"
  exit $probe_rc
fi

log "archive changed, launching opencode update"
cd "$ATLAS_DIR"
opencode run "$(cat <<'EOF'
License review tracker 自动更新任务。严格按以下流程执行，不要跳步：

1. 运行 `npm run update:tracker`（KB 路径默认 ../KB）。编排器已内嵌：灰色地带 manual review 按 scripts/tracker-manual-baseline.json 放行，invalid/missing 裁决条目自动用 LLM 重跑（最多 3 轮，key 缺失时自动读 /Users/momo/.config/opencode/opencode.json 的 zhipuai-coding-plan）。若报 "still invalid after 3 LLM retries" 或 "New manual-review item(s) outside the known baseline"：不 push，在日志记录残留/新增 ids 后结束（新基线条目留人工 review，人工确认后由维护者跑 `npm run update:tracker -- --rebaseline` 采纳）。
2. 质量门已内嵌于 update:tracker（全部必须 0 critical）。单独复核：KB 下 test-tracker-data / check-point-style --since 2026-01-01 / check-point-manifest-coverage；atlas 下 check-tracker-license-texts --tracker <KB v2 路径>。
3. `node scripts/sync-tracker.mjs` 同步，然后 `npm run lint`。
4. 判定与收尾：
   - 质量门全绿 + sync + lint 通过：提交 atlas 3 个 tracker 数据文件（commit message 说明新增邮件内容，格式参考 git log；如 scripts/tracker-manual-baseline.json 有 prune 变化一并提交），push。
   - 任何一步失败：不 push，恢复 `git checkout -- public/data/tracker.json src/data/tracker-index.json src/data/tracker-meta.json`，在日志总结失败原因。
5. 最终输出一段总结：新增邮件数、submission 状态变化、是否 push。
EOF
)" >> "$LOG" 2>&1
rc=$?

if [[ $rc -eq 0 ]]; then
  log "opencode update finished OK (rc=0) — check log above for whether it pushed"
else
  log "opencode update FAILED (rc=$rc) — see $LOG"
fi
exit $rc
