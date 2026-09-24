import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gasUrl = process.env.GAS_WEBHOOK_URL;
    if (!gasUrl) {
      console.warn('[API /api/reserve] GAS_WEBHOOK_URL is not set in environment variables.');
      // モック成功レスポンス（GAS URL未設定時用）
      return NextResponse.json({ success: true, mock: true });
    }

    // GAS の Web アプリ URL は匿名公開なので、共有秘密を本文に付けて GAS 側で検証させる（doPost はヘッダーを読めない）。
    // 秘密が未設定なら転送しない（fail-closed。未設定を「秘密なしで送る」にしない）。
    const secret = process.env.GAS_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[API /api/reserve] GAS_WEBHOOK_SECRET is not set; refusing to forward.');
      return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
    }

    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      // 秘密は最後に置く（クライアントが webhook_secret を送ってきても上書きする）
      body: JSON.stringify({ ...body, webhook_secret: secret }),
    });

    const data = await gasRes.json().catch(() => ({ success: true }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API /api/reserve] Error proxying to GAS:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
