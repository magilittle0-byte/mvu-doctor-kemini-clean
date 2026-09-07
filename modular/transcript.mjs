// Minimal transplant of Story Oracle v1.35.4 buildTranscriptTurns/buildTranscript.
// LifeState v5.35 getRecentExternalContext supplies the role boundary: assistant
// content is filtered, user input is retained. Native helpers and depth semantics
// remain owned by Story Oracle. See docs/modular/PHASE1_USER_HISTORY.md.
export function diagnosisTranscript(ctx, settings, { messageVisibleForTranscript, stripMechanismBlocks, regexEngine }) {
  if (settings.contextDepth === 0) return '';
  const coreChat = (ctx.chat || []).filter(message => messageVisibleForTranscript(message, settings.includeHiddenFloors));
  const useRegex = settings.applyRegex && regexEngine?.getRegexedString;
  let processed = coreChat.map((message, index) => {
    let text = message.mes;
    if (useRegex && !message.is_user) {
      const depth = coreChat.length - index - 1;
      try { text = regexEngine.getRegexedString(text, regexEngine.regex_placement.AI_OUTPUT, { isPrompt: true, depth }); }
      catch { /* Native fallback retains the original message on regex failure. */ }
    }
    return {
      role: message.is_user ? 'user' : 'assistant',
      name: message.name || (message.is_user ? ctx.name1 : ctx.name2),
      text: stripMechanismBlocks(message.is_user ? userInput(text) : text),
    };
  });
  processed = processed.filter(turn => turn.text && turn.text.trim() !== '');
  if (settings.contextDepth > 0) processed = processed.slice(-settings.contextDepth);
  return processed.map(turn => `[${turn.role === 'user' ? '用户输入' : '助手正文'}] ${turn.name}: ${turn.text}`).join('\n\n');
}

// Database spv8.4 extractLastTagContent, limited to its explicit input wrapper.
// Unwrapped or incomplete messages retain the original native fallback.
export function userInput(value) {
  const text = String(value || '');
  if (!text.trimStart().startsWith('以下是用户的本轮输入：')) return text;
  const tagName = '本轮用户输入';
  const lower = text.toLowerCase();
  const open = `<${tagName.toLowerCase()}>`;
  const close = `</${tagName.toLowerCase()}>`;
  const closeIdx = lower.lastIndexOf(close);
  if (closeIdx === -1) return text;
  const openIdx = lower.lastIndexOf(open, closeIdx);
  if (openIdx === -1) return text;
  return text.slice(openIdx + open.length, closeIdx).trim();
}
