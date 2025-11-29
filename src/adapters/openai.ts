const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ParsedCommand {
  intent: string;
  target?: string;
  parameters?: Record<string, string>;
  originalInput: string;
}

const SYSTEM_PROMPT = `You are a command parser for the DiscBurn Administrative Platform.

Parse user input into structured commands. Return JSON only.

Available intents:
- burn_to_disc: Prepare files for disc burning and upload to cloud
- backup: Backup files to OneDrive cloud storage
- sync: Synchronize files with cloud storage
- list: List available files
- status: Check platform and connection status
- watch: Monitor bidirectional signals between phone and DVD burner
- cancel: Cancel a burn job (target = job ID)
- send: Send signal to DVD burner
- automate: Start automation loop (monitors files, signals, retries failed jobs)
- execute: Execute a burn job and sync to OneDrive after completion
- package: Create a burn-ready package in OneDrive (download and burn on any PC)
- admin: Administrative functions (target can be: audit, config, registry)
- help: Show available commands
- clear: Clear burn queue
- unknown: Cannot understand the command

Examples:
"burn to disc all projects" -> {"intent": "burn_to_disc", "target": "all projects"}
"burn" -> {"intent": "burn_to_disc", "target": "all"}
"backup my documents" -> {"intent": "backup", "target": "documents"}
"status" -> {"intent": "status"}
"watch" -> {"intent": "watch"}
"monitor signals" -> {"intent": "watch"}
"cancel job123" -> {"intent": "cancel", "target": "job123"}
"send status" -> {"intent": "send", "target": "status"}
"admin audit" -> {"intent": "admin", "target": "audit"}
"help" -> {"intent": "help"}

Return ONLY valid JSON: {"intent": "...", "target": "...", "parameters": {...}}`;

export async function parseNaturalLanguage(input: string): Promise<ParsedCommand> {
  if (!OPENAI_API_KEY) {
    return fallbackParse(input);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input }
        ],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      const parsed = JSON.parse(content);
      return { ...parsed, originalInput: input };
    }
  } catch (error) {
    console.error('LLM parsing failed, using fallback');
  }

  return fallbackParse(input);
}

function fallbackParse(input: string): ParsedCommand {
  const lower = input.toLowerCase().trim();
  
  if (lower.includes('burn')) {
    const target = lower.replace(/burn|to|disc/g, '').trim() || 'all';
    return { intent: 'burn_to_disc', target, originalInput: input };
  }
  
  if (lower.includes('backup') || lower.includes('save') || lower.includes('upload')) {
    const target = lower.replace(/backup|save|upload|to|onedrive|cloud/g, '').trim() || 'all';
    return { intent: 'backup', target, originalInput: input };
  }
  
  if (lower.includes('sync')) {
    return { intent: 'sync', originalInput: input };
  }
  
  if (lower.includes('list') || lower.includes('files') || lower.includes('show')) {
    return { intent: 'list', originalInput: input };
  }
  
  if (lower.startsWith('send')) {
    const target = lower.replace('send', '').trim() || 'status';
    return { intent: 'send', target, originalInput: input };
  }
  
  if ((lower.includes('status') || lower.includes('check')) && !lower.startsWith('send')) {
    return { intent: 'status', originalInput: input };
  }
  
  if (lower === 'help' || lower === '?') {
    return { intent: 'help', originalInput: input };
  }
  
  if (lower === 'clear') {
    return { intent: 'clear', originalInput: input };
  }
  
  if (lower.startsWith('admin')) {
    const target = lower.replace('admin', '').trim() || 'help';
    return { intent: 'admin', target, originalInput: input };
  }
  
  if (lower === 'watch' || lower.includes('monitor') || lower.includes('signals')) {
    return { intent: 'watch', originalInput: input };
  }
  
  if (lower.startsWith('cancel')) {
    const target = lower.replace('cancel', '').trim();
    return { intent: 'cancel', target, originalInput: input };
  }
  
  if (lower.startsWith('automate') || lower === 'auto') {
    const target = lower.replace('automate', '').replace('auto', '').trim() || 'monitor';
    return { intent: 'automate', target, originalInput: input };
  }
  
  if (lower.startsWith('execute') || lower.startsWith('run burn') || lower.startsWith('do burn')) {
    const target = lower.replace('execute', '').replace('run burn', '').replace('do burn', '').trim();
    return { intent: 'execute', target, originalInput: input };
  }
  
  if (lower === 'package' || lower.includes('create package') || lower.includes('make iso')) {
    return { intent: 'package', originalInput: input };
  }
  
  return { intent: 'unknown', originalInput: input };
}
