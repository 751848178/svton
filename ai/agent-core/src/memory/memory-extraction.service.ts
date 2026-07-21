interface ExtractionProvider {
  chat: (msgs: unknown[], opts?: unknown) => AsyncGenerator<any>;
}

function buildConversationText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join('\n\n');
}

function parseFacts(extraction: string): string[] {
  return extraction
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 5 && line.length < 300)
    .slice(0, 5);
}

export async function extractMemorableFacts(
  messages: Array<{ role: string; content: string }>,
  provider: ExtractionProvider,
  model: string,
  existingMemoryText: string,
): Promise<string[]> {
  const convText = buildConversationText(messages);
  if (convText.length < 100) return [];

  const extractMessages = [
    {
      role: 'system',
      content: `Extract memorable facts from this conversation. Focus on:
- User preferences (coding style, language, tools, workflow)
- Important decisions or conclusions
- Project context (architecture, tech stack, conventions)
- Corrections the user made to the assistant

Output ONLY new facts not already in the existing memory. One fact per line, prefixed with "- ". If nothing memorable, output "NOTHING".`,
    },
    {
      role: 'user',
      content: `Existing memory:\n${existingMemoryText || '(empty)'}\n\nConversation:\n${convText}`,
    },
  ];

  let extraction = '';
  for await (const event of provider.chat(extractMessages, {
    model,
    maxTokens: 500,
    stream: true,
  })) {
    if (event.type === 'text_delta') extraction += event.text;
  }

  const trimmed = extraction.trim();
  if (!trimmed || trimmed === 'NOTHING') return [];
  return parseFacts(trimmed);
}
