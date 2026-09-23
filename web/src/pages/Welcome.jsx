import { useEffect, useState } from 'react';
import { Icon } from '../components/Icons.jsx';
import { INTEREST_ART } from '../lib/kinds.js';
import { api } from '../lib/api.js';
import { useAuth } from '../state/auth.jsx';
import { useUi } from '../state/ui.jsx';

const FIELD = { autoComplete: 'off', spellCheck: false };

/** The three ways in, the way Spotify does it: log in, make yourself an account, or get back in
    with a code when the password slipped. */
export function Welcome() {
  const { t, lang, setLang } = useUi();
  const { accounts, user, busy, errorCode, setErrorCode, signUp, logIn, sendCode, finishReset, saveInterests } = useAuth();
  const [mode, setMode] = useState(accounts === 0 ? 'signup' : 'login');
  const [details, setDetails] = useState({ name: '', email: '', password: '', terms: false });
  const [known, setKnown] = useState([]);
  const [picked, setPicked] = useState([]);
  const [step, setStep] = useState('enter');
  /* A code is asked for once and entered once; the address carries between the two halves. */
  const [recover, setRecover] = useState({ email: '', code: '', password: '', sent: false });

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

  const askCode = async (event) => {
    event.preventDefault();
    /* The answer is the same whether or not that address has an account, so nobody can use this
       form to find out who listens to Laxan. */
    if (await sendCode(recover.email)) setRecover((prev) => ({ ...prev, sent: true }));
  };

  const setNewPassword = async (event) => {
    event.preventDefault();
    if (await finishReset(recover.email, recover.code, recover.password)) {
      setRecover({ email: '', code: '', password: '', sent: false });
      setStep('enter');
      setMode('login');
    }
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

  if (step === 'recover') {
    return (
      <div className="welcome">
        <form className="welcome-card" onSubmit={recover.sent ? setNewPassword : askCode}>
          <span className="welcome-mark">Laxan</span>
          <h1>{t('auth.recoverTitle')}</h1>
          <p>{recover.sent ? t('auth.codeSent') : t('auth.recoverHint')}</p>

          <label>
            <span>{t('auth.email')}</span>
            <input
              {...FIELD}
              type="email"
              required
              readOnly={recover.sent}
              value={recover.email}
              onChange={(event) => {
                setErrorCode(null);
                setRecover((prev) => ({ ...prev, email: event.target.value }));
              }}
              placeholder="you@example.com"
            />
          </label>

          {recover.sent && (
            <>
              <label>
                <span>{t('auth.code')}</span>
                <input
                  {...FIELD}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={recover.code}
                  onChange={(event) => {
                    setErrorCode(null);
                    setRecover((prev) => ({ ...prev, code: event.target.value.replace(/\D/g, '') }));
                  }}
                  placeholder="000000"
                />
              </label>
              <label>
                <span>{t('auth.newPassword')}</span>
                <input
                  {...FIELD}
                  type="password"
                  required
                  minLength={6}
                  value={recover.password}
                  onChange={(event) => {
                    setErrorCode(null);
                    setRecover((prev) => ({ ...prev, password: event.target.value }));
                  }}
                  placeholder="••••••"
                />
              </label>
            </>
          )}

          {errorText && (
            <p className="welcome-error" role="alert">
              {errorText}
            </p>
          )}

          <button type="submit" className="pill-btn big-cta" disabled={busy}>
            {busy ? <Icon.disc /> : <Icon.next />}
            {recover.sent ? t('auth.setNew') : t('auth.sendCode')}
          </button>

          <button
            type="button"
            className="welcome-switch"
            onClick={() => {
              setErrorCode(null);
              setRecover({ email: '', code: '', password: '', sent: false });
              setStep('enter');
            }}
          >
            {t('auth.backToLogin')}
          </button>
        </form>
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

        {mode === 'signup' && (
          <label className="welcome-terms">
            <input
              type="checkbox"
              checked={details.terms}
              onChange={(event) => {
                setErrorCode(null);
                setDetails((prev) => ({ ...prev, terms: event.target.checked }));
              }}
            />
            <span>{t('auth.terms')}</span>
          </label>
        )}

        {errorText && (
          <p className="welcome-error" role="alert">
            {errorText}
          </p>
        )}

        <button type="submit" className="pill-btn big-cta" disabled={busy || (mode === 'signup' && !details.terms)}>
          {busy ? <Icon.disc /> : <Icon.play />}
          {mode === 'signup' ? t('auth.start') : t('auth.enter')}
        </button>

        <button type="button" className="welcome-switch" onClick={() => setMode(other)}>
          {other === 'signup' ? t('auth.noAccount') : t('auth.haveAccount')}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            className="welcome-switch"
            onClick={() => {
              setErrorCode(null);
              setRecover((prev) => ({ ...prev, email: details.email }));
              setStep('recover');
            }}
          >
            {t('auth.forgot')}
          </button>
        )}
      </form>
    </div>
  );
}
