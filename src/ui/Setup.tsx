import { useState } from 'react';
import { CITIES, MEMBERS, OSHI_TYPES, REGION_LABEL, type CityId, type MemberId, type NewGameOpts, type OshiType } from '../game';
import { MEMBER_COLOR } from './common';
import { Icon } from './icons';

export function Setup(props: { onStart: (o: NewGameOpts) => void; notice: string | null; onDismissNotice: () => void }) {
  const [oshi, setOshi] = useState<OshiType>('solo');
  const [member, setMember] = useState<MemberId>('A');
  const [city, setCity] = useState<CityId>('tokyo');
  const [seed, setSeed] = useState('');
  const [name, setName] = useState('');

  return (
    <main className="setup">
      <section className="hero">
        <div className="hero-beams" aria-hidden="true">
          <i /><i /><i />
        </div>
        <img className="hero-emblem" src="icons/icon.svg" alt="" width="64" height="64" />
        <p className="eyebrow">推し活トラベル × カードライブ（ソロ＋CPU）</p>
        <h1>推し活<span>人生ゲーム</span></h1>
        <p className="lead">12週間、ファンとして推し活を重ね、3つの公演でCPUとライブ対決。移動・探索・カード収集・デッキ編成・ライブバトルが一続きで遊べます。</p>
      </section>

      {props.notice && (
        <div className="notice" role="alert" data-testid="save-notice">
          <b>保存データを読み込めませんでした。</b>新しく始めます。
          <small>（{props.notice}）</small>
          <button type="button" className="btn ghost small" onClick={props.onDismissNotice}>OK</button>
        </div>
      )}

      <section className="panel">
        <h2>1. 推しタイプを選ぶ</h2>
        <div className="type-grid">
          {OSHI_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`type-card${oshi === t.id ? ' on' : ''}`}
              onClick={() => setOshi(t.id)}
              aria-pressed={oshi === t.id}
              data-testid={`oshi-${t.id}`}
            >
              <b>{t.name}</b>
              <em>{t.tagline}</em>
              <span>{t.passive}</span>
              <small><Icon name="sparkle" /> {t.strategy}</small>
            </button>
          ))}
        </div>
      </section>

      {oshi === 'solo' && (
        <section className="panel">
          <h2>2. 推しメンバー（仮の架空メンバー）</h2>
          <div className="member-grid">
            {MEMBERS.map((m) => (
              <button
                key={m}
                type="button"
                className={`member-btn${member === m ? ' on' : ''}`}
                style={{ borderColor: MEMBER_COLOR[m], color: member === m ? '#0b0820' : MEMBER_COLOR[m], background: member === m ? MEMBER_COLOR[m] : 'transparent' }}
                onClick={() => setMember(m)}
                aria-pressed={member === m}
                data-testid={`member-${m}`}
              >
                {m}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2>{oshi === 'solo' ? '3' : '2'}. 出発する都市</h2>
        <label className="field">
          <span>全都市で初期資金・体力は同じです。</span>
          <select value={city} onChange={(e) => setCity(e.target.value as CityId)} data-testid="city-select">
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}（{REGION_LABEL[c.region]}）</option>
            ))}
          </select>
        </label>
        <details className="adv">
          <summary>詳細設定（任意）</summary>
          <label className="field">
            <span>名前（12文字まで）</span>
            <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="あなた" />
          </label>
          <label className="field">
            <span>乱数シード（同じ値なら同じ展開を再現できます）</span>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="空欄ならランダム" data-testid="seed-input" />
          </label>
        </details>
      </section>

      <button
        type="button"
        className="btn primary big"
        data-testid="start-game"
        onClick={() =>
          props.onStart({
            oshi, member: oshi === 'solo' ? member : null, city, name,
            seed: seed.trim() === '' ? Date.now() : seed.trim(),
          })
        }
      >
        12週間の推し活をはじめる
      </button>

      <footer className="fine">
        <p>この試作は<b>ソロプレイ（CPU対戦）</b>のみです。オンライン・対人対戦は<b>今後追加予定（未実装）</b>です。</p>
        <p>登場するメンバーA〜H・スポット・施設・資産はすべて<b>架空</b>で、実在の人物・団体・施設とは関係ありません。進行は自動でブラウザに保存されます。</p>
      </footer>
    </main>
  );
}
