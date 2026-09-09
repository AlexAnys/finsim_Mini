/** Local transport fixture for real browser -> app -> DB -> AI-boundary tests.
 * It evaluates no teaching quality and is never imported by application code.
 * Start: node tests/e2e/pilot/mock-ai-server.mjs (127.0.0.1:3189).
 * Point a LOCAL app's MIMO_BASE_URL to http://127.0.0.1:3189/v1.
 * POST /_control { reset:true, mode:"auto"|"error"|"timeout", statusCode:503,
 *   delayMs:0, failNext:0, response:{...}, fixtures:[{contains:"text",response:{...}}] }
 * Omit response to use deterministic prompt fixtures; explicit responses override auto.
 * GET /_requests returns captured bodies (no authentication headers); DELETE clears them.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const defaults = () => ({ mode: 'auto', statusCode: 503, delayMs: 0, failNext: 0, fixtures: [] });
export function createMockAiServer() {
  let control = defaults();
  const requests = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const json = (status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); };
    try {
      if (url.pathname === '/health') return json(200, { ok: true, fixtureServer: true });
      if (url.pathname === '/_requests') {
        if (req.method === 'DELETE') requests.length = 0;
        return json(200, requests);
      }
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) return json(413, { error: 'fixture request too large' });
        chunks.push(chunk);
      }
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      if (url.pathname === '/_control') {
        if (req.method !== 'POST') return json(200, control);
        if (body.reset) { control = defaults(); requests.length = 0; }
        control = { ...control, ...body };
        return json(200, { ...control, fixtureServer: true });
      }
      if (!['/chat/completions', '/v1/chat/completions'].includes(url.pathname)) return json(404, { error: 'unknown fixture endpoint' });
      requests.push({ at: new Date().toISOString(), path: url.pathname, body });
      if (requests.length > 200) requests.shift();
      if (control.mode === 'timeout') return; // connection deliberately remains open until app aborts
      if (control.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(control.delayMs, 120_000)));
      if (control.mode === 'error' || control.failNext > 0) {
        control.failNext = Math.max(0, control.failNext - 1);
        return json(control.statusCode || 503, { error: { message: 'Controlled pilot upstream failure', type: 'server_error', code: 'fixture_error' } });
      }
      const prompt = (body.messages || []).map((message) => typeof message.content === 'string' ? message.content : JSON.stringify(message.content)).join('\n');
      const rule = control.fixtures.find((fixture) => typeof fixture.contains === 'string' && prompt.includes(fixture.contains));
      const output = rule ? rule.response : Object.hasOwn(control, 'response') ? control.response : automaticFixture(prompt);
      const content = typeof output === 'string' ? output : JSON.stringify(output);
      const id = `chatcmpl-pilot-${requests.length}`;
      const created = Math.floor(Date.now() / 1000);
      const model = body.model || 'fixture';
      const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
      if (!body.stream) return json(200, { id, object: 'chat.completion', created, model, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      const send = (delta, finishReason = null, extra = {}) => res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta, finish_reason: finishReason }], ...extra })}\n\n`);
      for (let i = 0; i < content.length; i += 8) send({ ...(i === 0 ? { role: 'assistant' } : {}), content: content.slice(i, i + 8) });
      send({}, 'stop', { usage });
      res.end('data: [DONE]\n\n');
    } catch (error) { json(400, { error: { message: String(error.message || error) } }); }
  });
  return server;
}

function automaticFixture(prompt) {
  if (prompt.includes('test-1-2-3')) return '123';
  if (prompt.includes('"mood_score"')) return { reply: '我希望先保留应急资金，再考虑分散投资。请解释风险与期限。', mood_score: 0.3, mood_label: '犹豫', student_perf: 0.8, deviated_dimensions: [] };
  if (prompt.includes('Socratic')) return { hint: '客户需要保留哪些应急资金，你准备如何确认？' };
  if (prompt.includes('rubricBreakdown')) {
    const ids = prompt.match(/criterionId 使用(?:以下 ID)?:\s*([^\n]+)/)?.[1].split(/[,，]/).map((id) => id.trim()).filter(Boolean) || [];
    const maximums = [...prompt.matchAll(/满分\s*([0-9.]+)\s*分/g)].map((match) => Number(match[1]));
    const studentText = prompt.match(/理财经理:\s*([^\n]+)/)?.[1] || '';
    const rubricBreakdown = ids.map((criterionId, index) => ({ criterionId, maxScore: maximums[index] ?? 10, score: Math.round((maximums[index] ?? 10) * 0.8 * 100) / 100, comment: '受控测试评分，用于核对发布与成绩流程。', evidence: [{ studentText, comment: studentText ? '引用输入中的学生文字。' : '该测试样例无模拟对话原句。' }] }));
    return { totalScore: rubricBreakdown.reduce((sum, row) => sum + row.score, 0), feedback: '这是受控 E2E 样例评分，不代表真实模型评价。', rubricBreakdown, conceptTags: ['风险与收益'] };
  }
  if (prompt.includes('学生作答:') && prompt.includes('满分:')) return { score: Number(prompt.match(/满分:\s*([0-9.]+)/)?.[1] || 1), comment: '受控简答评分。' };
  if (prompt.includes('一周洞察')) return { weakConceptsByCourse: [], classDifferences: [], studentClusters: [], upcomingClassRecommendations: [], highlightSummary: '本周教学需关注：这是受控测试摘要。' };
  if (prompt.includes('evidenceSubmissionIds')) return { commonIssues: [], highlights: [] };
  if (prompt.includes('conceptTags')) return { conceptTags: ['风险与收益'] };
  if (prompt.includes('"questions"')) return { questions: [
    { type: 'single_choice', prompt: '分散投资能否降低非系统性风险？', options: [{ id: 'A', text: '能' }, { id: 'B', text: '不能' }], correctOptionIds: ['A'], points: 2, difficulty: 1, explanation: '受控题目：分散投资降低非系统性风险。' },
    { type: 'short_answer', prompt: '解释风险与收益的关系。', correctAnswer: '预期收益通常与风险相关。', points: 3, difficulty: 1, explanation: '受控题目。' },
  ] };
  return '这是受控学习伙伴回复：请先识别风险，再比较期限与收益。';
}

async function selfTest() {
  const server = createMockAiServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const request = { model: 'fixture', messages: [{ role: 'user', content: '"mood_score"' }] };
    const chat = await (await post('/v1/chat/completions', request)).json();
    assert.equal(JSON.parse(chat.choices[0].message.content).mood_label, '犹豫');
    assert.match(await (await post('/v1/chat/completions', { ...request, stream: true })).text(), /data: \[DONE\]/);
    await post('/_control', { mode: 'error' });
    assert.equal((await post('/v1/chat/completions', request)).status, 503);
    assert.equal((await (await fetch(base + '/_requests')).json()).length, 3);
    console.log('pilot mock AI self-test: 4 assertions passed; loopback only, no external AI calls');
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--self-test')) await selfTest();
  else {
    const server = createMockAiServer();
    server.listen(Number(process.env.PILOT_MOCK_AI_PORT || 3189), '127.0.0.1', () => console.log(`pilot mock AI listening at http://127.0.0.1:${server.address().port}/v1`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.closeAllConnections(); server.close(() => process.exit()); });
  }
}
