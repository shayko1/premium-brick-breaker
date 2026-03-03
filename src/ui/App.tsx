import { useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas } from './GameCanvas';
import { createDefaultSettings, type Settings } from '../game/settings';
import { type GameSnapshot } from '../game/types';
import { useLocalStorageState } from './hooks/useLocalStorageState';

function formatNumber(n: number) {
  return new Intl.NumberFormat('he-IL').format(n);
}

export default function App() {
  const [settings, setSettings] = useLocalStorageState<Settings>(
    'pbb.settings.v1',
    createDefaultSettings(),
  );
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(!!mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const baseHelp = useMemo(
    () => 'חצים/‏A-D להזזה, רווח לשיגור, P להפסקה, M לסאונד, R לאתחול. במובייל: גררו באזור השליטה.',
    [],
  );

  return (
    <div className="container">
      <aside className="card gridSide" aria-label="לוח בקרה">
        <div className="header">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div className="titleWrap">
              <h1 className="h1">שובר לבנים — פרימיום</h1>
              <p className="subtitle">Arkanoid מודרני: שלבים, חיזוקים, ותחושה של מוצר</p>
            </div>
          </div>
          <div className="pills" aria-label="סטטוס">
            <div className="pill">
              <b>שלב</b> <small>{snapshot ? snapshot.level : 1}</small>
            </div>
            <div className="pill">
              <b>חיים</b> <small>{snapshot ? snapshot.lives : 3}</small>
            </div>
            <div className="pill">
              <b>ניקוד</b> <small>{formatNumber(snapshot ? snapshot.score : 0)}</small>
            </div>
            <div className="pill">
              <b>קומבו</b> <small>{snapshot ? snapshot.combo : 0}×</small>
            </div>
            <div className="pill">
              <b>דרגה</b> <small>{snapshot ? snapshot.grade : 'C'}</small>
            </div>
          </div>
        </div>

        <div className="btnRow" aria-label="פעולות">
          <button
            className="btn btnPrimary"
            onClick={() => window.dispatchEvent(new CustomEvent('pbb:start'))}
          >
            התחל / המשך
          </button>
          <button
            className="btn"
            onClick={() => window.dispatchEvent(new CustomEvent('pbb:pause'))}
          >
            השהה
          </button>
          <button
            className="btn btnDanger"
            onClick={() => window.dispatchEvent(new CustomEvent('pbb:reset'))}
          >
            אתחל
          </button>
        </div>

        <div className="sideContent">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
            />
            <span>סאונד</span>
          </label>
          <div style={{ height: 10 }} />
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => setSettings({ ...settings, highContrast: e.target.checked })}
            />
            <span>ניגודיות גבוהה</span>
          </label>
          <div style={{ height: 10 }} />
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.haptics}
              onChange={(e) => setSettings({ ...settings, haptics: e.target.checked })}
            />
            <span>רטט (מובייל)</span>
          </label>

          <ul className="list">
            <li>
              <span className="kbd">← →</span> / <span className="kbd">A D</span> — הזזת משטח
            </li>
            <li>
              <span className="kbd">רווח</span> — שיגור כדור / ירי (אם קיים)
            </li>
            <li>
              <span className="kbd">P</span> — הפסקה
            </li>
            <li>
              <span className="kbd">M</span> — השתקה/ביטול השתקה
            </li>
          </ul>
          <p style={{ margin: '10px 0 0', color: 'var(--muted2)', fontSize: 12 }}>
            {reducedMotion
              ? 'כיבדנו את “הפחתת תנועה” — האנימציות רגועות יותר.'
              : 'טיפ: כדור עם “אש” (🔥) עובר דרך לבנים לזמן קצר.'}
          </p>
        </div>

        <div className="footerNote">
          אין נכסים ממותגים/מוגנים. הכל ציור מקורי בקנבס + סאונד סינתטי.
          <div className="visuallyHidden" aria-live="polite" ref={liveRegionRef} />
          <div className="visuallyHidden">{baseHelp}</div>
        </div>
      </aside>

      <main className="card mainCard" aria-label="אזור המשחק">
        <div className="canvasWrap">
          <div className="hudOverlay">
            <div className="toast" aria-live="polite">
              <p className="toastTitle">{snapshot?.statusText ?? 'מוכן?'}</p>
              <p className="toastBody">
                {snapshot?.hint ??
                  'לחצו “התחל” או רווח. במובייל: גררו באזור השליטה כדי להזיז את המשטח.'}
              </p>
            </div>
            <div className="toast" style={{ textAlign: 'left' }}>
              <p className="toastTitle">בונוסים פעילים</p>
              <p className="toastBody">
                {snapshot?.activePowerUps?.length
                  ? snapshot.activePowerUps.join(' · ')
                  : 'אין כרגע — שברו לבנים כדי להפיל חיזוקים'}
              </p>
            </div>
          </div>

          <div className="canvasFrame">
            <GameCanvas settings={settings} onSnapshot={setSnapshot} />
          </div>

          <section className="mobileControls" aria-label="שליטה במובייל">
            <div className="touchPad" data-touch="move">
              <div className="touchLabel">גרירה להזזה</div>
            </div>
            <div className="touchPad" data-touch="action">
              <div className="touchLabel">לחיצה לשיגור/השהיה</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
