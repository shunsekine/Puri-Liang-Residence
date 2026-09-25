import { CONFIG } from './Config';

// 顧客へのメールの文面（一次返信・最終回答の下書き）。2026-09-24 に Templates シートから移した。**正本はこのファイル**。
// シートに置いていた間に、事業ルールとのずれ（キャンセル 3 日前・電気の実費精算）、_id の行の欠落、見出し行の有無による
// 読み飛ばしが起きた。コードにしたので、全種類×3 言語がそろっていること・差し込み文字・事業ルールの値（デポジット・電気の目安・
// キャンセルの日数）が lib/data.ts と一致することを test/templates.test.js が検査する。
// 文面を変えたら build-gs.sh の出力を貼り直す（README「反映手順」。トリガーから呼ばれるので、保存した時点で使われる）。
// 差し込み: {ID} {Name} {CheckIn} {CheckOut} {RoomType} {Guests}（EmailService.replacePlaceholders）。日付の書式は言語ごと（MAIL_DATE_PATTERNS）

export type TemplateKind = '1MonthLater' | '1MonthWithin' | 'Available' | 'Full' | 'AcceptWaiting';
export type TemplateLanguage = 'ja' | 'en' | 'id';
export interface MailTemplate {
  subject: string;
  body: string;
}

/** 一次返信（受信の 15 分後に自動送信）。チェックインが 1 ヶ月以上先か以内かで種類を分けているが、今は同じ文面 */
const INITIAL_REPLY_TEMPLATES: Record<TemplateLanguage, MailTemplate> = {
  ja: {
    subject: '【Puri Liang Residence】ご予約の問い合わせを承りました（確認中）',
    body: [
      '{Name} 様',
      '',
      'Puri Liang Residenceへのお問い合わせありがとうございます。',
      '現在、以下の内容で空室状況を確認しております。',
      '',
      '・チェックイン: {CheckIn}',
      '・チェックアウト: {CheckOut}',
      '・ご希望のお部屋: {RoomType}',
      '・人数: {Guests} 名様',
      '',
      '確認が取れ次第、改めてご連絡いたします。',
      '今しばらくお待ちくださいませ。',
    ].join('\n'),
  },
  en: {
    subject: '[Puri Liang Residence] We received your inquiry (Checking availability)',
    body: [
      'Dear {Name},',
      '',
      'Thank you for inquiring with Puri Liang Residence.',
      'We are currently checking the availability for your requested dates:',
      '',
      '- Check-in: {CheckIn}',
      '- Check-out: {CheckOut}',
      '- Room: {RoomType}',
      '- Guests: {Guests}',
      '',
      'We will get back to you as soon as possible.',
      'Thank you for your patience.',
    ].join('\n'),
  },
  id: {
    subject: '[Puri Liang Residence] Terima kasih atas pertanyaan Anda',
    body: [
      'Halo {Name},',
      '',
      'Terima kasih telah menghubungi Puri Liang Residence.',
      'Saat ini kami sedang mengecek ketersediaan kamar untuk permintaan berikut:',
      '',
      '- Check-in: {CheckIn}',
      '- Check-out: {CheckOut}',
      '- Kamar: {RoomType}',
      '- Jumlah tamu: {Guests} orang',
      '',
      'Kami akan segera menghubungi Anda kembali setelah pengecekan selesai.',
      'Terima kasih atas kesabaran Anda.',
    ].join('\n'),
  },
};

export const MAIL_TEMPLATES: Record<TemplateKind, Record<TemplateLanguage, MailTemplate>> = {
  '1MonthLater': INITIAL_REPLY_TEMPLATES,
  '1MonthWithin': INITIAL_REPLY_TEMPLATES,
  /** 最終回答: 空室（下書き。担当者が決済リンクを書き足して送る） */
  Available: {
    ja: {
      subject: '【Puri Liang Residence】ご予約確定のお願い（空室あり）',
      body: [
        '{Name} 様',
        '',
        'お待たせいたしました。ご希望の日程で【空室】がございました。',
        '',
        'ご予約を確定するには、以下のWiseリンクより、ご滞在期間分の家賃の全額をお支払いください。',
        '■ 決済リンク: (※ここに決済リンクを手動で追記して送信してください)',
        '',
        '【お支払いについて】',
        '・家賃は全額前払いです。ご入金が確認でき次第、予約確定となります。',
        '・チェックイン時にお支払いいただくのは、デポジット Rp 2,000,000 のみです（未払いがなければチェックアウト時に全額返金します）。',
        '・お部屋の電気はプリペイド式です。滞在中、チャージしたいときにスタッフへ代金をお渡しいただければ代行します（目安：1名あたり月 Rp 300,000）。',
        '',
        '【キャンセルポリシー】',
        '・チェックイン7日前まで：全額返金（返金時の振込手数料の実費を差し引きます）',
        '・それ以降：返金不可',
        '',
        '詳細な宿泊規約につきましては、以下のページをご確認ください。',
        'https://puri-liang-residence.vercel.app/ja/faq#terms',
      ].join('\n'),
    },
    en: {
      subject: '[Puri Liang Residence] Room Available - Please Complete Payment',
      body: [
        'Dear {Name},',
        '',
        'Good news! Your requested room is available for your dates.',
        '',
        'To confirm your booking, please pay the full rent for your stay via the Wise link below.',
        '■ Payment link: (Please add the link before sending)',
        '',
        '[Payment]',
        '- The full rent is paid in advance. Your booking is confirmed as soon as we receive your payment.',
        '- At check-in, you pay only the Rp 2,000,000 deposit (returned in full at check-out if nothing is outstanding).',
        '- In-room electricity is prepaid. During your stay, just hand the amount to our staff whenever you want to top up, and they will do it for you (roughly Rp 300,000 per person per month).',
        '',
        '[Cancellation policy]',
        '- Up to 7 days before check-in: full refund (minus the actual bank transfer fee for the refund)',
        '- After that: non-refundable',
        '',
        'For the full terms and conditions, please see:',
        'https://puri-liang-residence.vercel.app/en/faq#terms',
      ].join('\n'),
    },
    id: {
      subject: '[Puri Liang Residence] Kamar tersedia untuk tanggal pilihan Anda',
      body: [
        'Halo {Name},',
        '',
        'Kabar baik! Kamar pilihan Anda tersedia untuk tanggal yang Anda inginkan.',
        '',
        'Untuk mengonfirmasi reservasi, silakan lunasi seluruh biaya sewa untuk masa inap Anda melalui tautan Wise di bawah ini.',
        '■ Tautan pembayaran: (Tambahkan tautan sebelum mengirim)',
        '',
        '[Pembayaran]',
        '- Seluruh biaya sewa dibayar di muka. Reservasi terkonfirmasi setelah pembayaran kami terima.',
        '- Saat check-in, Anda hanya membayar deposit Rp 2.000.000 (dikembalikan penuh saat check-out jika tidak ada tunggakan).',
        '- Listrik kamar menggunakan sistem prabayar. Selama menginap, cukup serahkan uangnya kepada staf saat ingin mengisi ulang, dan staf akan mengisikannya untuk Anda (perkiraan Rp 300.000 per orang per bulan).',
        '',
        '[Kebijakan pembatalan]',
        '- Paling lambat 7 hari sebelum check-in: pengembalian dana penuh (dikurangi biaya transfer bank yang sebenarnya)',
        '- Setelah itu: tidak ada pengembalian dana',
        '',
        'Syarat & ketentuan lengkap dapat dibaca di:',
        'https://puri-liang-residence.vercel.app/id/faq#terms',
      ].join('\n'),
    },
  },
  /** 最終回答: 満室（キャンセル待ちの案内） */
  Full: {
    ja: {
      subject: '【Puri Liang Residence】満室のご連絡およびキャンセル待ちのご案内',
      body: [
        '{Name} 様',
        '',
        'お問い合わせありがとうございます。',
        '大変申し訳ございませんが、ご希望の日程はあいにく【満室】となっております。',
        '',
        'もしよろしければ「キャンセル待ち」として登録させていただきます。',
        'ご希望の場合は、本メールに「キャンセル待ち希望」とご返信ください。',
      ].join('\n'),
    },
    en: {
      subject: '[Puri Liang Residence] Room Fully Booked (Waitlist Available)',
      body: [
        'Dear {Name},',
        '',
        'Thank you for your inquiry.',
        'Unfortunately, the room you requested is fully booked for your dates.',
        '',
        'However, we can add you to our waitlist.',
        'If you would like to join the waitlist, please simply reply to this email with "Waitlist Request".',
      ].join('\n'),
    },
    id: {
      subject: '[Puri Liang Residence] Informasi ketersediaan kamar',
      body: [
        'Halo {Name},',
        '',
        'Terima kasih atas pertanyaan Anda.',
        'Mohon maaf, kamar pilihan Anda sudah penuh untuk tanggal tersebut.',
        '',
        'Namun, kami bisa memasukkan Anda ke daftar tunggu.',
        'Jika berminat, cukup balas email ini dengan "Daftar tunggu".',
      ].join('\n'),
    },
  },
  /** 最終回答: キャンセル待ちの受付 */
  AcceptWaiting: {
    ja: {
      subject: '【Puri Liang Residence】キャンセル待ちを承りました',
      body: [
        '{Name} 様',
        '',
        'キャンセル待ちへのご登録、承りました。',
        '空室が出ましたら、すぐにご連絡させていただきます。',
      ].join('\n'),
    },
    en: {
      subject: '[Puri Liang Residence] Waitlist Confirmed',
      body: [
        'Dear {Name},',
        '',
        'You have been added to our waitlist.',
        'We will contact you immediately if a room becomes available.',
      ].join('\n'),
    },
    id: {
      subject: '[Puri Liang Residence] Anda sudah masuk daftar tunggu',
      body: [
        'Halo {Name},',
        '',
        'Anda sudah kami masukkan ke daftar tunggu.',
        'Kami akan segera menghubungi Anda jika ada kamar yang tersedia.',
      ].join('\n'),
    },
  },
};

/**
 * 差し込む日付（{CheckIn} {CheckOut}）の書式（Utilities.formatDate の記号・スクリプトのタイムゾーン）。null は toLocaleDateString
 * （GAS の既定は米国式の 11/4/2026）。日本語は 2026-09-25 のユーザー指示で日本式にした
 */
const MAIL_DATE_PATTERNS: Record<TemplateLanguage, string | null> = { ja: 'yyyy年M月d日', en: null, id: null };

/** 文面に差し込む日付。言語が ja・en・id 以外なら英語と同じ（英語の文面で代用するため） */
export function formatMailDate(date: Date, language: string): string {
  const lang = String(language ?? '').trim();
  const pattern = Object.prototype.hasOwnProperty.call(MAIL_DATE_PATTERNS, lang) ? MAIL_DATE_PATTERNS[lang as TemplateLanguage] : null;
  return pattern ? Utilities.formatDate(date, Session.getScriptTimeZone(), pattern) : date.toLocaleDateString();
}

/**
 * 種類と言語の文面。言語が ja・en・id 以外（秘密を知る者の直接 POST など）なら英語（CONFIG.TEMPLATE_FALLBACK_LANGUAGE）で代用し、
 * fallbackFrom に元の言語を入れる。自分のキーだけを見る（添字だと constructor 等のプロトタイプのキーが通る）
 */
export function mailTemplateFor(kind: TemplateKind, language: string): MailTemplate & { language: TemplateLanguage, fallbackFrom: string | null } {
  const byLanguage = MAIL_TEMPLATES[kind];
  const lang = String(language ?? '').trim();
  if (Object.prototype.hasOwnProperty.call(byLanguage, lang)) {
    const l = lang as TemplateLanguage;
    return { ...byLanguage[l], language: l, fallbackFrom: null };
  }
  const fallback = CONFIG.TEMPLATE_FALLBACK_LANGUAGE as TemplateLanguage;
  return { ...byLanguage[fallback], language: fallback, fallbackFrom: lang || '(空)' };
}
