import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { getUser, unauthorized } from '@/lib/auth'
import { getTool, toolCatalogue, type UiAction } from '@/lib/ai-tools'

/**
 * AI Assistant chat endpoint.
 *
 * The assistant runs with the *same* identity as the human user — every tool
 * call goes through the same getUser(req) auth path as if the user clicked
 * the buttons themselves. So the AI cannot do anything the user could not
 * do manually. That is the security model.
 *
 * LLM tool-calling is implemented manually (z-ai-web-dev-sdk does not expose
 * a native tools API yet). We give the LLM a tool catalogue in the system
 * prompt and ask it to emit JSON with optional `tool_calls`. We loop until
 * the LLM stops requesting tools (max 6 rounds to avoid runaway loops).
 */

const SYSTEM_PROMPT = `You are Forge, the in-app AI assistant for ApkForge — a no-code Android APK builder platform.

Your job: help the signed-in user do ANYTHING they could do by clicking around the UI. You can read their account, create and edit projects, add/replace files, start APK builds, and navigate them around the app.

You speak the user's language. By default reply in the same language the user used (Bengali, English, or mixed). Keep replies short, friendly, and concrete. Use plain text — no markdown tables, no code blocks unless the user explicitly asks for code.

You have access to a set of tools. Each round, decide whether to call tools or to answer. To call tools, respond with ONLY a JSON object in this exact shape (no prose, no code fences):
{"thought":"1-2 sentences of private reasoning","tool_calls":[{"name":"tool_name","args":{...}}]}

When you have no more tools to call, respond with normal prose (NOT JSON) as your user-facing reply. Don't mention "tool_calls" or "thought" in user-facing replies.

RULES:
- Always call get_account_summary the first time the user opens a session, so you know who you're talking to.
- If the user asks for an app like "calculator", "to-do list", "notes", or "weather" — use create_app_with_recipe (much faster than manually creating files). If no recipe fits, use create_project then add_file for each file.
- After creating or editing a project, call open_editor so the user sees the result.
- After starting a build, tell the user it has been queued and they can watch progress in the Console view. Don't promise a finished APK time — the cloud build engine may not be configured.
- NEVER invent project IDs or file IDs. Always list_projects / get_project_files first when you need to operate on existing items.
- If a tool returns ok=false, explain the error to the user in plain language and suggest a fix. Don't repeat the JSON error verbatim.
- Be concise. Two or three sentences per reply is usually enough.
- If the user asks for something you can't do (e.g. payments, account deletion), say so honestly and point them at the right place.

Available tools:
{{TOOL_CATALOGUE}}`

interface ToolCall { name: string; args: Record<string, unknown> }
interface ChatTurn { role: 'user' | 'assistant' | 'system'; content: string }

const MAX_TOOL_ROUNDS = 6

/**
 * Try to parse a tool-call envelope out of an LLM response.
 * The model is asked to emit strict JSON, but we tolerate code fences and
 * leading/trailing prose as a fallback.
 */
function parseToolCalls(text: string): { thought?: string; tool_calls?: ToolCall[] } | null {
  let t = text.trim()
  // strip ```json fences if present
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  // try direct parse first
  try {
    const obj = JSON.parse(t)
    if (obj && (obj.tool_calls || obj.answer !== undefined)) return obj
  } catch {
    // fall through — try to extract the first {...} block
  }
  // find the first { and the matching last }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first >= 0 && last > first) {
    const slice = t.slice(first, last + 1)
    try {
      const obj = JSON.parse(slice)
      if (obj && (obj.tool_calls || obj.answer !== undefined)) return obj
    } catch {
      /* give up */
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  let body: { message?: string; history?: ChatTurn[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const userMessage = String(body.message || '').trim()
  if (!userMessage) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
  if (userMessage.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 })
  }

  // Conversation history provided by the client (capped at the last 14 turns
  // to keep things reasonable). We always prepend our system prompt.
  const incomingHistory = Array.isArray(body.history) ? body.history.slice(-14) : []

  let zai: Awaited<ReturnType<typeof ZAI.create>>
  try {
    zai = await ZAI.create()
  } catch (e) {
    console.error('ZAI init failed', e)
    return NextResponse.json({
      error: 'AI assistant is unavailable right now. The Z.ai config file is missing — please make sure `.z-ai-config` exists in the project root (it ships with the Vercel zip).',
    }, { status: 503 })
  }

  const systemContent = SYSTEM_PROMPT.replace('{{TOOL_CATALOGUE}}', toolCatalogue())

  // The live conversation we feed to the LLM each round.
  const conversation: ChatTurn[] = [
    { role: 'system', content: systemContent },
    ...incomingHistory.map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: String(m.content || ''),
    })),
    { role: 'user', content: userMessage },
  ]

  // Final reply sent back to the client. We accumulate tool round summaries
  // and emit the final user-facing answer.
  let finalReply = ''
  const actions: UiAction[] = []
  const toolLog: { name: string; summary: string; ok: boolean }[] = []
  let rounds = 0
  let lastError: string | null = null

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++
    let completion
    try {
      // Z.ai's free model — GLM-5.2. We retry up to 3 times with a short
      // backoff because the Z.ai gateway occasionally rate-limits (429)
      // on bursts of tool calls.
      let lastErr: unknown = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          completion = await zai.chat.completions.create({
            model: 'GLM-5.2',
            messages: conversation,
            thinking: { type: 'disabled' },
          })
          lastErr = null
          break
        } catch (e) {
          lastErr = e
          const msg = (e as Error).message || ''
          // 429 → retry with backoff; other errors → bail out.
          if (msg.includes('429') && attempt < 2) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
            continue
          }
          break
        }
      }
      if (lastErr) throw lastErr
    } catch (e) {
      console.error('ZAI completion error', e)
      lastError = (e as Error).message
      break
    }
    const assistantText: string = completion?.choices?.[0]?.message?.content || ''
    if (!assistantText) {
      lastError = 'Empty response from AI'
      break
    }
    const parsed = parseToolCalls(assistantText)
    if (!parsed || !Array.isArray(parsed.tool_calls) || parsed.tool_calls.length === 0) {
      // No tool calls — treat assistantText as the final user-facing reply.
      finalReply = assistantText
        // strip stray tool-call JSON if the model accidentally inlined it
        .replace(/\{[\s\S]*?"tool_calls"[\s\S]*?\}/g, '')
        .replace(/```(?:json)?\s*[\s\S]*?```/g, '')
        .trim()
      if (!finalReply) finalReply = "I wasn't sure how to respond — could you rephrase?"
      break
    }

    // Record the assistant's tool-request turn so the next round has context.
    conversation.push({ role: 'assistant', content: assistantText })

    // Execute each requested tool and feed results back to the LLM as a
    // single user message containing a JSON envelope.
    const toolResults: string[] = []
    for (const call of parsed.tool_calls) {
      const tool = getTool(call.name)
      if (!tool) {
        toolLog.push({ name: call.name, summary: 'Unknown tool', ok: false })
        toolResults.push(JSON.stringify({ tool: call.name, error: `Unknown tool "${call.name}"` }))
        continue
      }
      try {
        const result = await tool.run(call.args || {}, req)
        toolLog.push({ name: call.name, summary: result.summary, ok: result.ok })
        if (result.ui && result.ui.length) actions.push(...result.ui)
        toolResults.push(JSON.stringify({
          tool: call.name,
          ok: result.ok,
          summary: result.summary,
          data: result.data ?? null,
          error: result.error ?? null,
        }))
      } catch (e) {
        const msg = (e as Error).message || 'Tool execution failed'
        toolLog.push({ name: call.name, summary: msg, ok: false })
        toolResults.push(JSON.stringify({ tool: call.name, ok: false, error: msg }))
      }
    }

    conversation.push({
      role: 'user',
      content: `Tool results:\n${toolResults.join('\n')}\n\nContinue. If you have everything you need, give the user a short final answer (no JSON).`,
    })
  }

  if (!finalReply) {
    if (lastError) {
      finalReply = `Sorry, I hit a snag while thinking that through (${lastError}). Could you try again?`
    } else if (toolLog.length > 0) {
      const lastOk = [...toolLog].reverse().find((t) => t.ok)
      if (lastOk) {
        finalReply = `Done! ${lastOk.summary}. Anything else you'd like me to do?`
      } else {
        finalReply = "I tried but couldn't complete that — please try a different wording."
      }
    } else {
      finalReply = "I'm not sure how to help with that yet — could you give me a bit more detail?"
    }
  }

  // Trim very long final replies so the chat bubble stays readable.
  if (finalReply.length > 1200) finalReply = finalReply.slice(0, 1200) + '…'

  return NextResponse.json({
    reply: finalReply,
    actions,
    toolLog,
  })
}

export const runtime = 'nodejs'
