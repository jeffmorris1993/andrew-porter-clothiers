/* Responses-API-shaped fixtures, modeled on the real response structure
   (output items: web_search_call + message with url_citation annotations). */

type Cite = { url: string; title: string; text: string };

/** Builds a realistic web_search response whose text cites each URL inline. */
export function webSearchResponse(paragraphs: Cite[][], consulted: string[] = [], model = "gpt-5.4-mini") {
  let text = "";
  const annotations: Record<string, unknown>[] = [];
  for (const para of paragraphs) {
    for (const c of para) {
      text += c.text;
      const link = ` ([${new URL(c.url).hostname}](${c.url}))`;
      annotations.push({ type: "url_citation", url: c.url, title: c.title, start_index: text.length, end_index: text.length + link.length });
      text += link + " ";
    }
    text += "\n\n";
  }
  return {
    id: "resp_test",
    object: "response",
    model,
    status: "completed",
    output: [
      { type: "web_search_call", id: "ws_1", status: "completed", action: { type: "search", query: "q", sources: consulted.map((url) => ({ type: "url", url })) } },
      { type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations }] },
    ],
    output_text: text,
    usage: { input_tokens: 1200, output_tokens: 400, total_tokens: 1600, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 100 } },
  };
}

export function structuredResponse(data: unknown, model = "gpt-5.4-mini") {
  const text = JSON.stringify(data);
  return {
    id: "resp_struct",
    object: "response",
    model,
    status: "completed",
    output: [{ type: "message", id: "msg_2", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] }],
    output_text: text,
    usage: { input_tokens: 2000, output_tokens: 600, total_tokens: 2600, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 200 } },
  };
}

/** A fake ResponsesClient that returns queued responses and records requests. */
export function fakeClient(queue: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  return {
    requests,
    responses: {
      async create(body: Record<string, unknown>) {
        requests.push(body);
        const next = queue.shift();
        if (!next) throw new Error("fake client: queue empty");
        if (next instanceof Error) throw next;
        return next as never;
      },
    },
  };
}
