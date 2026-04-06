export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { words } = req.body;
  if (!words || !words.length) {
    return res.status(400).json({ error: '단어 목록이 필요합니다.' });
  }

  const wordList = words.slice(0, 20).map(w => `${w.term}: ${w.def}`).join('\n');

  const prompt = `다음 영단어 목록을 사용해서 토익 Part 5 형식의 빈칸 채우기 문제 10개를 만들어주세요.

단어 목록:
${wordList}

규칙:
- 각 문제마다 단어 목록에서 1개의 단어를 사용해서 영어 문장 만들기
- 빈칸(______)에 들어갈 단어를 맞히는 형식
- 보기 4개: 정답 1개 + 오답 3개 (비슷한 뜻이나 형태의 단어들)
- 한국어 해설 포함

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이, 마크다운 없이):
[
  {
    "sentence": "The manager asked us to ------- the report by Friday.",
    "blank_word": "submit",
    "options": ["submit", "delay", "cancel", "review"],
    "answer": 0,
    "type": "vocab",
    "explanation": "submit은 '제출하다'라는 뜻으로, 문맥상 보고서를 제출하라는 내용이 자연스럽습니다."
  }
]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // 빠르고 저렴한 모델
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'API 오류' });
    }

    const data = await response.json();
    let text = data.content.filter(c => c.type === 'text').map(c => c.text).join('');
    text = text.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(text);
    return res.status(200).json({ questions });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '서버 오류: ' + e.message });
  }
}
