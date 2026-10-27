import { useEffect, useRef, useState } from 'react';
import { CITY_MAP, currentConcert, OSHI_MAP, TOTAL_WEEKS, yen, AP_PER_WEEK, MAX_STAMINA } from '../game';
import { Collection, DeckScreen } from './Cards';
import { Home } from './Home';
import { LiveScreen } from './Live';
import { MapScreen } from './MapScreen';
import { ChoiceModal, Help, Trophies, Tutorial } from './Misc';
import { Setup } from './Setup';
import { useGame } from './useGame';
import { Bar } from './common';
import { WeekIntro } from './WeekIntro';

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
  const { state: s, dispatch, start, reset, toast, notice, dismissNotice, showToast, weekIntro, dismissWeekIntro } = useGame();
  const statusRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [tutorial, setTutorial] = useState(false);

  // ライブ開始時は自動でライブ画面へ
  const liveActive = !!s?.live;
  useEffect(() => { if (liveActive) setTab('live'); }, [liveActive]);

  // 固定/追従バーの実高さをCSS変数へ（文字拡大でバーが折り返しても本文・追従要素と重ならないように）
  const hasGame = !!s;
  useEffect(() => {
    const root = document.documentElement;
    const targets: [HTMLElement | null, string][] = [[statusRef.current, '--status-h'], [tabsRef.current, '--tabs-h']];
    const measure = () => { for (const [el, name] of targets) if (el) root.style.setProperty(name, `${Math.ceil(el.getBoundingClientRect().height)}px`); };
    measure();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const ro = new ResizeObserver(measure);
    for (const [el] of targets) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [hasGame]);

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
      <header className="status" data-testid="status-bar" ref={statusRef}>
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

      <nav className="tabs" aria-label="メインメニュー" ref={tabsRef}>
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
      {weekIntro && !tutorial && !s.pending && !s.finished && <WeekIntro data={weekIntro} onClose={dismissWeekIntro} />}
      <ToastView toast={toast} />
    </div>
  );
}

function ToastView({ toast }: { toast: ReturnType<typeof useGame>['toast'] }) {
  if (!toast) return null;
  return <div key={toast.id} className={`toast ${toast.kind}`} role="status" data-testid="toast">{toast.text}</div>;
}

