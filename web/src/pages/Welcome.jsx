import { useEffect, useState } from 'react';
import { Icon } from '../components/Icons.jsx';
import { INTEREST_ART } from '../lib/kinds.js';
import { api } from '../lib/api.js';
import { useAuth } from '../state/auth.jsx';
import { useUi } from '../state/ui.jsx';

const FIELD = { autoComplete: 'off', spellCheck: false };

/** The two ways in, the way Spotify does it: log in, or make yourself an account. */
export function Welcome() {
  const { t, lang, setLang } = useUi();
  const { accounts, user, busy, errorCode, setErrorCode, signUp, logIn, saveInterests } = useAuth();
  const [mode, setMode] = useState(accounts === 0 ? 'signup' : 'login');
  const [details, setDetails] = useState({ name: '', email: '', password: '' });
  const [known, setKnown] = useState([]);
  const [picked, setPicked] = useState([]);
  const [step, setStep] = useState('enter');

  useEffect(() => {
    api.interests().then((res) => setKnown(res?.interests ?? [])).catch(() => {});
    if (user) setPicked(user.interests ?? []);
  }, [user]);

  /* A returning listener who never chose interests gets straight to the picker. */
  useEffect(() => {
    if (user && !user.interests?.length) setStep('interests');
  }, [user]);

  const fill = (key) => (event) => {
    setErrorCode(null);
    setDetails((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const enter = async (event) => {
    event.preventDefault();
    const ok = mode === 'signup' ? await signUp(details) : await logIn(details.email, details.password);
    if (ok && mode === 'signup') setStep('interests');
  };

  const finish = async () => {
    if (!picked.length) return;
    await saveInterests(picked);
    setStep('enter');
  };

  const toggle = (id) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const other = mode === 'signup' ? 'login' : 'signup';
  const errorText = errorCode ? t(`err.${errorCode}`) : null;

  if (step === 'interests') {
    return (
      <div className="welcome pick">
        <div className="welcome-card">
          <span className="welcome-mark">Laxan</span>
          <h1>{t('auth.interestsTitle')}</h1>
          <p>{t('auth.interestsHint')}</p>
          <div className="pick-grid">
            {known.map((item) => {
              const Glyph = Icon[INTEREST_ART[item.id]] ?? Icon.song;
              const on = picked.includes(item.id);
              return (
                <button key={item.id} type="button" className={`pick-tile ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(item.id)}>
                  <span className="pick-glyph">
                    <Glyph />
                  </span>
                  <span>{t(`shelf.${item.id}`)}</span>
                  {on && <Icon.check />}
                </button>
              );
            })}
          </div>
          {picked.length === 0 && <p className="pick-hint">{t('auth.pickSome')}</p>}
          <button type="button" className="pill-btn big-cta" disabled={!picked.length || busy} onClick={finish}>
            {t('auth.next')}
            <Icon.next />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome">
      <div className="welcome-brand">
        <span className="welcome-mark">Laxan</span>
        <h1>{t('auth.tagline')}</h1>
        <p>{t('browse.hint')}</p>
        <button type="button" className="welcome-lang" onClick={() => setLang(lang === 'en' ? 'so' : 'en')}>
          <Icon.globe />
          {t('auth.language')}: {lang === 'en' ? 'Soomaali' : 'English'}
        </button>
      </div>

      <form className="welcome-card" onSubmit={enter}>
        <div className="welcome-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            {t('auth.signIn')}
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            {t('auth.signUp')}
          </button>
        </div>

        {mode === 'signup' && (
          <label>
            <span>{t('auth.name')}</span>
            <input {...FIELD} value={details.name} onChange={fill('name')} placeholder={user?.name ?? 'Maryam'} />
          </label>
        )}
        <label>
          <span>{t('auth.email')}</span>
          <input {...FIELD} type="email" required value={details.email} onChange={fill('email')} placeholder="you@example.com" />
        </label>
        <label>
          <span>{t('auth.password')}</span>
          <input {...FIELD} type="password" required minLength={6} value={details.password} onChange={fill('password')} placeholder="••••••" />
        </label>

        {errorText && (
          <p className="welcome-error" role="alert">
            {errorText}
          </p>
        )}

        <button type="submit" className="pill-btn big-cta" disabled={busy}>
          {busy ? <Icon.disc /> : <Icon.play />}
          {mode === 'signup' ? t('auth.start') : t('auth.enter')}
        </button>

        <button type="button" className="welcome-switch" onClick={() => setMode(other)}>
          {other === 'signup' ? t('auth.noAccount') : t('auth.haveAccount')}
        </button>
      </form>
    </div>
  );
}
