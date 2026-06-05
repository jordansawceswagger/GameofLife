import { spawn } from 'node:child_process'

export interface RunClaudeOptions {
  model?: string
  /** Milliseconds before the child is killed and a timeout error returned. */
  timeout?: number
  cwd?: string
}

export interface ClaudeResult {
  response: string
  error?: string
}

const DEFAULT_TIMEOUT = 120_000
/** Overridable: Electron's PATH may not include ~/.local/bin where claude lives. */
const CLAUDE_BIN = process.env.GOL_CLAUDE_BIN ?? 'claude'

export function buildArgs(prompt: string, opts?: RunClaudeOptions): string[] {
  const args = ['-p', prompt, '--output-format', 'json']
  if (opts?.model) args.push('--model', opts.model)
  return args
}

/**
 * Extract the assistant text from `claude -p --output-format json` output.
 * The CLI returns a JSON object with the final text under `result`; we also
 * accept a couple of fallbacks. Throws on invalid JSON (caller maps to an error).
 */
export function parseClaudeJson(stdout: string): string {
  const trimmed = stdout.trim()
  const obj = JSON.parse(trimmed) as Record<string, unknown>
  if (typeof obj.result === 'string') return obj.result
  if (typeof obj.response === 'string') return obj.response
  if (typeof obj.text === 'string') return obj.text
  return trimmed
}

/**
 * Wrap the Claude Code CLI as a subprocess. Never throws: timeouts, non-zero
 * exits, spawn failures, and JSON parse errors all resolve to
 * { response: '', error }.
 */
export function runClaudeCode(prompt: string, opts?: RunClaudeOptions): Promise<ClaudeResult> {
  return new Promise((resolve) => {
    const timeoutMs = opts?.timeout ?? DEFAULT_TIMEOUT
    const child = spawn(CLAUDE_BIN, buildArgs(prompt, opts), { cwd: opts?.cwd })

    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (result: ClaudeResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ response: '', error: `claude timed out after ${timeoutMs}ms` })
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err: Error) => {
      finish({ response: '', error: `failed to spawn claude: ${err.message}` })
    })

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        finish({ response: '', error: `claude exited with code ${code}: ${stderr.trim()}` })
        return
      }
      try {
        finish({ response: parseClaudeJson(stdout) })
      } catch (err) {
        finish({ response: '', error: `failed to parse claude JSON: ${(err as Error).message}` })
      }
    })
  })
}
