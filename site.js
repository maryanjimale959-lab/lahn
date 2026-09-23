/* Laxan's landing page. Somali is what the HTML already says; Arabic and English arrive from the
   dictionary below, because a page about a Somali app must still read as Somali with JavaScript off.
   Everything that moves here is a turntable, a needle or a bar of equaliser — nothing decorative
   spins when the visitor has asked for less motion. */

const LANG_KEY = 'laxan.site.lang';

const STRINGS = {
  /* Only the strings the page says out loud after a click — the rest of the Somali is already in the
     markup, so a visitor with JavaScript off still reads a Somali page. */
  so: {
    'toast.ios': 'iPhone-ka: riix Share, dabadeed «Add to Home Screen».',
    'toast.android': 'Browser-ku install ma soo jeedinayo hadda — fur liiskiisa oo dooro «Add to Home Screen».',
    'toast.desktop': 'Kombiyuutarka: liiska browser-ka ka dooro «Install Laxan» si uu ab ahaan u joogo.',
  },
  ar: {
    'nav.screens': 'الشاشات',
    'nav.features': 'المزايا',
    'nav.arabic': 'العربية',
    'nav.how': 'كيف يعمل',
    'nav.faq': 'أسئلة',
    'nav.open': 'افتح لَخان',
    'hero.eyebrow': 'قرآن · أغانٍ · بودكاست · قصص · دروس',
    'hero.t1': 'كل صوت',
    'hero.t2': 'هو',
    'hero.t3': 'صومالي',
    'hero.t4': '— في تطبيق واحد.',
    'hero.lede':
      'لَخان هو تطبيق الأصوات الصومالية: قران بستة قرّاء، وأغانٍ صومالية، وبودكاست صومالي، وقصص، ودروس، وكتب مسموعة. اضغط واسمع — لا تنزيل، ولا بيانات تُرسل عنك.',
    'hero.cta1': 'ابدأ الاستماع',
    'hero.cta2': 'ثبّته على هاتفك',
    'hero.fine': 'مجاني · بلا إعلانات · بلا تسجيل',
    'hero.now': 'يُشغَّل الآن · Mishary Alafasy — سورة الفاتحة',
    'stat.items': 'مقطع جاهز',
    'stat.sources': 'مصدر صوت',
    'stat.songs': 'أغانٍ على صفحات فنانيها',
    'stat.surahs': 'سورة كاملة',
    'features.kicker': 'ما هو جاهز لك',
    'features.title': 'تطبيق واحد. أصوات كثيرة.',
    'f1.h': 'قرآن كامل',
    'f1.p': '١١٤ سورة بستة قرّاء معروفين — مشاري العفاسي، وعبد الباسط، والمنشاوي، وأبو بكر الشاطري، وماهر. اضغط على سورة لتبدأ.',
    'f2.h': 'بودكاست صومالي',
    'f2.p': 'Maamul Wanaag، وميزان، وهيلوو، وGarasho-wadaag، وAdeeg Wanaag، وDiiwaanka Mahad — أكثر من ١٤٠ حلقة بالصومالية.',
    'f3.h': 'قصص وقضايا حقيقية',
    'f3.p': 'Sheeko iyo Shaahid وقصص صومالية أخرى تُسمع بالليل — خزانة كاملة للقصص.',
    'f4.h': 'دروس وكتب مسموعة',
    'f4.p': 'Duruus Manhaj وBuugaag Codka Ubax — دروس وكتب تسمعها وأنت تمشي، دون أن تنظر إلى الشاشة.',
    'f5.h': 'أغانٍ صومالية وعربية',
    'f5.p': 'رفوف هييسو، وراب، وجاعيل، والموسيقى العربية: ١٤٤ أغنية. عند الضغط على أغنية تنتقل إلى صفحة صاحبها، فيُحسب المشاهدة له.',
    'f6.h': 'لك، لا للإعلانات',
    'f6.p': 'لا إعلانات. ولا تتبّع. ولا بيع لحساباتك. لَخان يعمل على أجهزتك، وأنت الوحيد الذي يسمع ما استمعت إليه.',
    'how.kicker': 'كيف يعمل',
    'how.title': 'ثلاث خطوات.',
    's1.h': 'افتح الرابط',
    's1.p': 'افتح لَخان على حاسوبك أو هاتفك — لا برنامج يُثبَّت، ولا حساب يُنشأ.',
    's2.h': 'أضفه إلى الشاشة الرئيسية',
    's2.p': 'على أندرويد: اضغط «ثبّته». على آيفون: Share ثم «Add to Home Screen». سيصير تطبيقاً بأيقونته.',
    's3.h': 'اختر، اضغط، واسمع',
    's3.p': 'قل ما تحب — قرآن، بودكاست، قصص، دروس، كتب — فتأتيك الرئيسية إلى هناك، وضغطة واحدة تبدأ الصوت.',
    'priv.h': 'لَخان الكامل — نسخة بيتك',
    'priv.p':
      'هذا الرابط العام يعرض الرفوف التي أذن أصحابها للجميع بسماعها، وأغانٍ تُشغَّل من صفحات فنانيها. النسخة التي تعمل على حاسوبك فيها أيضاً حسابات بالبريد وأجهزة متصلة — حاسوبك هو الخادم، وهاتفك يتصل به في البيت.',
    'priv.1': 'أغانٍ إضافية تضعها على حاسوبك',
    'priv.2': 'حساب بريد وكلمة سر، ولكل فرد قائمته',
    'priv.3': 'حاسوب وهاتف متصلان: ابدأ في مكان، وأكمل في آخر',
    'install.kicker': 'التثبيت',
    'install.title': 'خذ لَخان معك.',
    'install.lede': 'يُثبَّت لَخان على شاشتك الرئيسية كتطبيق عادي — بلا متجر، بلا حساب.',
    'badge.and.small': 'ثبّته على',
    'badge.and.big': 'أندرويد',
    'badge.ios.small': 'ثبّته على',
    'install.note': 'لَخان ليس في App Store ولا Play Store — هو تطبيق مفتوح يصل من صفحتك، ولهذا هو مجاني.',
    'faq.kicker': 'أسئلة',
    'faq.title': 'ما يسأل عنه الناس.',
    q1: 'هل هو مجاني؟',
    a1: 'نعم، كله. لا إعلانات، ولا حدود، ولا بيع لكلمة سر. لَخان يعمل على أجهزتك، وليس خدمة تُبحث عن المال.',
    q2: 'هل أحتاج إلى تسجيل؟',
    a2: 'هذا الرابط العام: لا. افتح واسمع. الحسابات بالبريد وكلمة السر تكون في النسخة التي تعمل على حاسوبك، حيث يكون لكل فرد في البيت قائمته.',
    q3: 'هل الموسيقى الصومالية موجودة هنا؟',
    a3: 'نعم. رفوف هييسو، والراب، وجاعيل موجودة هنا — ١٤٤ أغنية. لكل أغنية صفحتها، فالضغطة تفتح صفحة الفنان وتُحسب له. أما القرآن والبودكاست والقصص فتأتي من مصادر تنشر صوتها بنفسها.',
    q4: 'هل يعمل بلا إنترنت؟',
    a4: 'لا. لَخان بث مباشر — لا شيء يُخزَّن على جهازك، ولهذا تحتاج إلى إنترنت. وهذا سبب كونه مفتوحاً في كل مكان ولا يملأ ذاكرة جهازك.',
    q5: 'هل يعمل على هاتفي وحاسوبي؟',
    a5: 'نعم. أندرويد وآيفون، وكروم وإيدج وسفاري وفيورفوكس. الواجهة بالصومالية والعربية (من اليمين) والإنجليزية، فاتحة وداكنة.',
    q6: 'من صنع لَخان؟',
    a6: 'Maryam J. — شخص واحد أراد تطبيقاً يتحدث الصومالية بلا إعلانات. حين احتاجه غيره، وجد هذا الرابط.',
    'last.h': 'ابدأ الاستماع الآن.',
    'last.p': '٢٬٧٧٣ مقطعاً و١٬٠٤٥ أغنية جاهزة. ضغطة واحدة.',
    'last.cta': 'افتح لَخان',
    'foot.tag': 'الأصوات الصومالية، في مكان واحد.',
    'foot.open': 'افتح لَخان',
    'foot.made': 'صنعه: Maryam J. · ٢٠٢٦',
    'foot.rights': 'لَخان ليس في App Store ولا Play Store. الرفوف من مصادر مفتوحة أذن أصحابها بالنشر.',
    'ios.title': 'أضفه إلى شاشة آيفون',
    'ios.1': 'افتح هذا الرابط في Safari.',
    'ios.2': 'اضغط زر Share (الصندوق ذو السهم للأعلى).',
    'ios.3': 'اختر «Add to Home Screen».',
    'ios.4': 'اضغط لَخان من شاشتك الرئيسية — سيفتح كتطبيق كامل.',
    'ios.close': 'إغلاق',
    'toast.ios': 'على آيفون: Share ثم «Add to Home Screen».',
    'toast.android': 'لم يعرض المتصفح التثبيت الآن — افتح القائمة واختر «Add to Home Screen».',
    'toast.desktop': 'على الحاسوب: من قائمة المتصفح اختر «Install Laxan» لتثبيته كتطبيق.',
  },
  en: {
    'nav.screens': 'Screens',
    'nav.features': 'What it does',
    'nav.arabic': 'Arabic',
    'nav.how': 'How it works',
    'nav.faq': 'FAQ',
    'nav.open': 'Open Laxan',
    'hero.eyebrow': 'Quran · Songs · Podcasts · Stories · Lessons',
    'hero.t1': 'Every sound',
    'hero.t2': 'that is',
    'hero.t3': 'Somali',
    'hero.t4': '— in one app.',
    'hero.lede':
      "Laxan is the Somali audio app: Quran from six reciters, Somali songs, podcasts, stories, lessons and audiobooks. Tap and it plays — you download nothing, and nothing about you leaves the device.",
    'hero.cta1': 'Start listening',
    'hero.cta2': 'Install on your phone',
    'hero.fine': 'Free · No ads · No sign-up',
    'hero.now': 'Playing now · Mishary Alafasy, Al-Faatihah',
    'stat.items': 'listens ready',
    'stat.sources': 'audio sources',
    'stat.songs': 'songs on their artists’ pages',
    'stat.surahs': 'surahs, complete',
    'features.kicker': 'What is ready for you',
    'features.title': 'One app. Many voices.',
    'f1.h': 'The whole Quran',
    'f1.p':
      '114 surahs from six well-known reciters — Mishary Alafasy, Abdul Basit, Al-Minshawi, Abu Bakr Al-Shatri and Maher. Tap a surah and it starts.',
    'f2.h': 'Somali podcasts',
    'f2.p':
      'Maamul Wanaag, Miizaan, Hiloow, Garasho-wadaag, Adeeg Wanaag and Diiwaanka Mahad — more than 140 episodes in Somali.',
    'f3.h': 'Stories and true cases',
    'f3.p': 'Sheeko iyo Shaahid and more Somali stories to listen to at night — a whole shelf of them.',
    'f4.h': 'Lessons and audiobooks',
    'f4.p': 'Duruus Manhaj and Buugaag Codka Ubax — lessons and books you can hear while walking, without looking at a screen.',
    'f5.h': 'Somali songs, and Arabic ones',
    'f5.p': 'The Heeso, Rap and Jaceyl shelves: 1,045 songs. Tap one and you land on the artist’s own page, so the view is counted for them.',
    'f6.h': 'Yours, not advertising',
    'f6.p':
      'No ads. No tracking. No selling accounts. Laxan runs on your hardware, and you are the only one who sees what you listened to.',
    'how.kicker': 'How it works',
    'how.title': 'Three steps.',
    's1.h': 'Open the link',
    's1.p': 'Open Laxan on your computer or phone — no program to install, no account to make.',
    's2.h': 'Add it to your home screen',
    's2.p': 'Android: press "Install". iPhone: Share, then "Add to Home Screen". It becomes an app with its own icon.',
    's3.h': 'Choose, tap, listen',
    's3.p':
      'Say what you like — Quran, podcasts, stories, lessons, books — and Home brings you there. One tap starts the audio.',
    'priv.h': 'Full Laxan — the copy at home',
    'priv.p':
      'This public link shows the shelves whose owners published them for everyone, and songs that play on their artists’ own pages. The copy that runs on your computer adds email accounts and linked devices — your computer is the server, and your phone joins it at home.',
    'priv.1': 'Add your own songs, on your computer',
    'priv.2': 'Email + password accounts, one list per person',
    'priv.3': 'Linked computer and phone: start in one room, carry on in another',
    'install.kicker': 'Install',
    'install.title': 'Put Laxan in your pocket.',
    'install.lede': 'Laxan installs onto your home screen like a normal app — no store, no account.',
    'badge.and.small': 'Install for',
    'badge.and.big': 'Android',
    'badge.ios.small': 'Install for',
    'install.note': 'Laxan is not in the App Store or Play Store — it is an open app that arrives from your own page, which is why it costs nothing.',
    'faq.kicker': 'FAQ',
    'faq.title': 'What people ask.',
    q1: 'Is it free?',
    a1: 'All of it. No ads, no limits, no selling your password. Laxan runs on your hardware — it is not a service hunting for money.',
    q2: 'Do I have to sign up?',
    a2: 'This public link: no. Open it and listen. Email and password accounts belong to the copy running on your own computer, where each person in the house gets their own list.',
    q3: 'Is the Somali music here?',
    a3:
      'Yes. The Heeso, Rap and Jaceyl shelves are here — 1,045 songs. Every song has its own page, so a tap opens the artist’s page and the view goes to them. The Quran, podcasts and stories come from feeds that publish their own audio.',
    q4: 'Does it work offline?',
    a4:
      'No. Laxan streams — nothing is stored on your device, so it needs internet. That is why it is open anywhere and never fills your storage.',
    q5: 'Does it work on my phone and computer?',
    'a5': 'Yes. Android and iPhone, Chrome, Edge, Safari and Firefox. The interface speaks Somali, Arabic (right to left) and English, in light and dark.',
    q6: 'Who made Laxan?',
    a6: 'Maryam J. — one person who wanted a Somali-language app with no ads. When someone else needed it, this link is what they got.',
    'last.h': 'Start listening now.',
    'last.p': '2,773 listens and 1,045 songs are ready. One tap.',
    'last.cta': 'Open Laxan',
    'foot.tag': 'Somali voices, in one place.',
    'foot.open': 'Open Laxan',
    'foot.made': 'Built by Maryam J. · 2026',
    'foot.rights': 'Laxan is not in the App Store or Play Store. The shelves come from open sources their owners published.',
    'ios.title': 'Add it to your iPhone screen',
    'ios.1': 'Open this link in Safari.',
    'ios.2': 'Press the Share button (the box with the arrow up).',
    'ios.3': "Choose 'Add to Home Screen'.",
    'ios.4': 'Tap Laxan on your home screen — it opens as a full app.',
    'ios.close': 'Close',
    'toast.ios': 'On iPhone: Share, then "Add to Home Screen".',
    'toast.android': 'The browser is not offering an install right now — open its menu and choose "Add to Home Screen".',
    'toast.desktop': 'On a computer: pick "Install Laxan" from the browser menu to keep it as an app.',
  },
};

const isRtl = (lang) => lang === 'ar';

const stored = () => {
  const l = localStorage.getItem(LANG_KEY);
  return l === 'ar' || l === 'en' || l === 'so' ? l : 'so';
};

/* Somali and English count in Latin figures, Arabic in its own — a page that switches language
   mid-number would otherwise show ١٬008. */
const numberLocale = () => (document.documentElement.lang === 'ar' ? 'ar-EG' : 'en-US');
const showNumber = (n) => n.toLocaleString(numberLocale());

function setLang(lang) {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = isRtl(lang) ? 'rtl' : 'ltr';
  /* The Somali text is the markup itself, so the first switch has to remember it — otherwise
     "back to Somali" leaves an English or Arabic page behind. */
  const original = (node, html) => {
    if (!node.dataset.so) node.dataset.so = html ? node.innerHTML : node.textContent;
    return node.dataset.so;
  };
  const say = (key, node, html) => {
    const value = lang === 'so' ? null : STRINGS[lang]?.[key];
    if (html) node.innerHTML = value ?? original(node, true);
    else node.textContent = value ?? original(node, false);
  };
  for (const node of document.querySelectorAll('[data-i18n]')) say(node.dataset.i18n, node, false);
  for (const node of document.querySelectorAll('[data-i18n-html]')) say(node.dataset.i18nHtml, node, true);
  for (const node of document.querySelectorAll('[data-count]')) {
    if (node.dataset.shown) node.textContent = showNumber(Number(node.dataset.shown));
  }
  document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  localStorage.setItem(LANG_KEY, lang);
}

const toast = (message) => {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 5200);
};

/* The honest version of a store badge: the browser offers an install when the manifest and the
   service worker are in place. Android gives us the event; iOS never does, so it gets instructions. */
let installEvent = null;
addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installEvent = event;
  document.querySelectorAll('[data-install]').forEach((b) => (b.disabled = false));
});
addEventListener('message', (event) => event.data === 'installed' && (installEvent = null));
addEventListener('appinstalled', () => {
  installEvent = null;
});

const iOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

async function install(which) {
  const lang = document.documentElement.lang;
  const say = (key) => toast(STRINGS[lang]?.[key] ?? STRINGS.en[key]);
  if (which === 'ios' || iOS()) {
    document.getElementById('ios-sheet').hidden = false;
    return;
  }
  if (installEvent) {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (outcome !== 'accepted') say('toast.android');
    installEvent = null;
    return;
  }
  say('toast.android');
}

function countUp(node) {
  const target = Number(node.dataset.count || node.textContent);
  const start = performance.now();
  const ms = 1150;
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = showNumber(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
    else node.dataset.shown = target;
  };
  requestAnimationFrame(step);
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function boot() {
  const lang = stored();
  if (lang !== 'so') setLang(lang);
  else document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === 'so')));

  document.querySelectorAll('.langs button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  document.querySelectorAll('[data-install]').forEach((b) => {
    b.addEventListener('click', () => install(b.dataset.install === 'android' ? 'android' : 'ios'));
  });
  const sheet = document.getElementById('ios-sheet');
  sheet.querySelector('[data-close-sheet]').addEventListener('click', () => (sheet.hidden = true));
  sheet.addEventListener('click', (event) => event.target === sheet && (sheet.hidden = true));
  addEventListener('keydown', (event) => event.key === 'Escape' && (sheet.hidden = true));

  const top = document.getElementById('top');
  const onScroll = () => top.classList.toggle('stuck', scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const revealables = document.querySelectorAll('.reveal');
  if (reduceMotion) {
    revealables.forEach((n) => n.classList.add('in'));
    document.querySelectorAll('[data-count]').forEach((n) => {
      n.dataset.shown = Number(n.dataset.count);
      n.textContent = showNumber(Number(n.dataset.count));
    });
    return;
  }
  revealables.forEach((n) => {
    const siblings = [...(n.parentElement?.children ?? [])];
    n.style.transitionDelay = `${Math.min(siblings.indexOf(n), 6) * 70}ms`;
  });
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        seen.unobserve(entry.target);
      }
    },
    { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
  );
  revealables.forEach((n) => seen.observe(n));

  const counters = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countUp(entry.target);
        counters.unobserve(entry.target);
      }
    },
    { threshold: 0.6 }
  );
  document.querySelectorAll('[data-count]').forEach((n) => counters.observe(n));
}

boot();
