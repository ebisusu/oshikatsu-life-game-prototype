import { useEffect, useState } from 'react';
import { CITY_MAP, currentConcert, OSHI_MAP, TOTAL_WEEKS, yen, AP_PER_WEEK, MAX_STAMINA } from '../game';
import { Collection, DeckScreen } from './Cards';
import { Home } from './Home';
import { LiveScreen } from './Live';
import { MapScreen } from './MapScreen';
import { ChoiceModal, Help, Trophies, Tutorial } from './Misc';
import { Setup } from './Setup';
import { useGame } from './useGame';
import { Bar } from './common';

export type Tab = 'home' | 'map' | 'collection' | 'deck' | 'live' | 'trophy' | 'help';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: '🏠' },
  { id: 'map', label: 'マップ', icon: '🗾' },
  { id: 'collection', label: '収集', icon: '🃏' },
  { id: 'deck', label: 'デッキ', icon: '🎴' },
  { id: 'live', label: 'ライブ', icon: '🎤' },
  { id: 'trophy', label: '実績', icon: '🏆' },
  { id: 'help', label: 'ヘルプ', icon: '❓' },
];

const TUTORIAL_KEY = 'oshikatsu-jinsei-game:tutorial-seen';
const readSeen = (): boolean => { try { return window.localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; } };
const writeSeen = () => { try { window.localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* ignore */ } };

export function App() {
  const { state: s, dispatch, start, reset, toast, notice, dismissNotice, showToast } = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [tutorial, setTutorial] = useState(false);

  // ライブ開始時は自動でライブ画面へ
  const liveActive = !!s?.live;
  useEffect(() => { if (liveActive) setTab('live'); }, [liveActive]);

  if (!s) {
    return (
      <>
        <Setup
          notice={notice}
          onDismissNotice={dismissNotice}
          onStart={(o) => { if (!start(o)) return; setTab('home'); if (!readSeen()) setTutorial(true); }}
        />
        <ToastView toast={toast} />
      </>
    );
  }

  const concert = currentConcert(s);
  const livePending = !!concert && s.concerts[concert.id]?.status === 'pending';
  const closeTutorial = () => { writeSeen(); setTutorial(false); };

  return (
    <div className="app">
      <header className="status" data-testid="status-bar">
        <div className="st-row">
          <span className="st-week" data-testid="st-week">第{s.week}<small>/{TOTAL_WEEKS}週</small></span>
          <span className="st-ap" data-testid="st-ap" aria-label={`AP ${s.ap}/${AP_PER_WEEK}`}>
            AP {Array.from({ length: AP_PER_WEEK }).map((_, i) => <i key={i} className={`ap-pip${i < s.ap ? ' on' : ''}`} />)}
          </span>
          <span className="st-money" data-testid="st-money">{yen(s.money)}</span>
        </div>
        <div className="st-row sub">
          <span className="st-hp">体力 <b data-testid="st-stamina">{s.stamina}</b>/{MAX_STAMINA}</span>
          <Bar value={s.stamina} max={MAX_STAMINA} cls={s.stamina < 30 ? 'b-low' : 'b-hp'} />
          <span className="st-type">{OSHI_MAP[s.oshi].name}{s.oshiMember ? `・${s.oshiMember}` : ''}</span>
          <span className="st-city">📍{CITY_MAP[s.city].name}</span>
        </div>
      </header>

      <div className="content" data-tab={tab}>
        {tab === 'home' && <Home s={s} dispatch={dispatch} go={setTab} onReset={reset} toast={showToast} />}
        {tab === 'map' && <MapScreen s={s} dispatch={dispatch} />}
        {tab === 'collection' && <Collection s={s} dispatch={dispatch} />}
        {tab === 'deck' && <DeckScreen s={s} dispatch={dispatch} />}
        {tab === 'live' && <LiveScreen s={s} dispatch={dispatch} />}
        {tab === 'trophy' && <Trophies s={s} />}
        {tab === 'help' && <Help s={s} onReset={() => { reset(); setTab('home'); }} onTutorial={() => setTutorial(true)} toast={showToast} />}
      </div>

      <nav className="tabs" aria-label="メインメニュー">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined} data-testid={`tab-${t.id}`}>
            <span aria-hidden="true">{t.icon}</span>
            <small>{t.label}</small>
            {t.id === 'live' && (livePending || liveActive) && <i className="dot-alert" aria-label="ライブあり" />}
            {t.id === 'deck' && s.newCards.length > 0 && <i className="dot-alert" aria-label="新規カードあり" />}
          </button>
        ))}
      </nav>

      <ChoiceModal s={s} dispatch={dispatch} />
      {tutorial && <Tutorial onClose={closeTutorial} />}
      <ToastView toast={toast} />
    </div>
  );
}

function ToastView({ toast }: { toast: ReturnType<typeof useGame>['toast'] }) {
  if (!toast) return null;
  return <div key={toast.id} className={`toast ${toast.kind}`} role="status" data-testid="toast">{toast.text}</div>;
}

