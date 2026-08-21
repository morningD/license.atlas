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

1. 运行 `npm run update:tracker`（KB 路径默认 ../KB）。LLM 环境变量已由系统提供；若无，从 /Users/momo/.config/opencode/opencode.json 的 provider zhipuai-coding-plan 读 key，设 ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN=该 key、ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic、STATUS_ADJUDICATION_MODEL=glm-4.6、POINTS_MODEL=glm-4.6 后重跑。
2. 若 apply-status-adjudications 报 input_hash mismatch 阻塞：读 KB/data/osi/status-adjudication/manual-review.json 找出 mismatch 的 ids，用上述 env 重跑 `node scripts/run-status-adjudication.mjs --mode local --ids <逗号分隔>`（若个别条目报 JSON 解析失败 ✗，重跑该条 1-2 次），再 `node scripts/apply-status-adjudications.mjs --allow-manual-pending`。证据冲突类的 manual review 项（非 hash mismatch）保持现状即可。
3. 质量门（全部必须 0 critical）：KB 下 test-tracker-data / check-point-style --since 2026-01-01 / check-point-manifest-coverage；atlas 下 check-tracker-license-texts --tracker <KB v2 路径>。
4. `node scripts/sync-tracker.mjs` 同步，然后 `npm run lint`。
5. 判定与收尾：
   - 质量门全绿 + sync + lint 通过：提交 atlas 3 个 tracker 数据文件（commit message 说明新增邮件内容，格式参考 git log），push。
   - 任何一步失败或出现新的证据冲突 manual review 项：不 push，恢复 `git checkout -- public/data/tracker.json src/data/tracker-index.json src/data/tracker-meta.json`，在日志总结失败原因。
6. 最终输出一段总结：新增邮件数、submission 状态变化、是否 push。
EOF
)" >> "$LOG" 2>&1
rc=$?

if [[ $rc -eq 0 ]]; then
  log "opencode update finished OK (rc=0) — check log above for whether it pushed"
else
  log "opencode update FAILED (rc=$rc) — see $LOG"
fi
exit $rc
