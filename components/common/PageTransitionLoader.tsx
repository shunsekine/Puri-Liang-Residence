'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * PageTransitionLoader
 * -------------------------------------------------------------
 * 初回ロード + 全ページ遷移時に表示するローディングオーバーレイ。
 *
 * App Router にはルート変更イベントが無いため、以下の手法で実装:
 *  1. 内部リンクのクリックを document レベルで捕捉 → 即オーバーレイ表示
 *  2. usePathname() の変化（＝遷移完了）を検知 → 最小表示時間を経て非表示
 *  3. ブラウザの戻る/進む(popstate) も表示トリガに含める
 *
 * ちらつき防止のため最小表示時間 MIN_DISPLAY_MS を設けている。
 * オーバーレイは SSR 時点で DOM に存在し、マウント後に制御される
 * （= 初回ロードでも最初のペイントから覆える）。
 */

const MIN_DISPLAY_MS = 600;

export default function PageTransitionLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true); // 初回ロードは表示状態で開始
  const shownAtRef = useRef<number>(Date.now());
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    shownAtRef.current = Date.now();
    setVisible(true);
  }, []);

  const hideWithMinDuration = useCallback(() => {
    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), remaining);
  }, []);

  // pathname 変化（初回マウント含む）で非表示処理。
  // = 初回ロード後、および各ページ遷移完了後にフェードアウトする。
  useEffect(() => {
    hideWithMinDuration();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [pathname, hideWithMinDuration]);

  // 内部リンクのクリックを捕捉して表示開始
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      // 左クリック以外 / 修飾キー付き（新規タブ等）は無視
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // 外部リンクは対象外
      if (url.origin !== window.location.origin) return;
      // 同一ページ（ハッシュ/クエリのみの変化）は遷移しないので対象外
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      show();
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [show]);

  // ブラウザの戻る/進む
  useEffect(() => {
    function onPopState() {
      show();
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [show]);

  return (
    <div
      className={`plr-loading-overlay${visible ? '' : ' is-hidden'}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="plr-spinner-wrap">
        <svg
          className="plr-spinner-ring"
          viewBox="0 0 280 280"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="plrRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E85555" stopOpacity="0" />
              <stop offset="60%" stopColor="#E85555" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#E85555" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="140"
            cy="140"
            r="124"
            fill="none"
            stroke="#e0ddd6"
            strokeWidth="7"
          />
          <path
            d="M 140 16 A 124 124 0 1 1 139.9 16"
            fill="none"
            stroke="url(#plrRingGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            style={{ strokeDasharray: '600 780' }}
          />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="plr-centered-logo"
          src="/images/loader-logo.png"
          alt="Puri Liang Residence"
        />
      </div>
      <p className="plr-status-text">Loading...</p>
    </div>
  );
}
