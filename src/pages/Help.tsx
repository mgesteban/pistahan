// Static how-to page: /help — volunteer guide first, maps, coordinator guide below.
const MAPS = [
  { file: '/parade-route.png', title: 'Parade route' },
  { file: '/parade-assembly.png', title: 'Parade assembly' },
  { file: '/disembarkment.png', title: 'Parade disembarkment' },
  { file: '/pavilion.png', title: 'Festival site map (Yerba Buena Gardens)' },
  { file: '/check-in-pavilion.png', title: 'Volunteer check-in & Hospitality Pavilion' },
  { file: '/evacuation.png', title: 'Evacuation routes' },
]

export default function Help() {
  return (
    <main className="shell help">
      <header className="statusbar">
        <span className="brand">Pistahan 33 · How It Works</span>
      </header>
      <img
        className="help-hero"
        src="/pistahan.png"
        alt="Pistahan Parade + Festival marchers carrying the banner and Philippine flags"
      />
      <p className="help-lede">
        33rd Annual Pistahan Parade &amp; Festival · Aug 8–9, 2026 · San
        Francisco
      </p>
      <nav className="help-nav">
        <a href="#volunteers">For volunteers</a>
        <a href="#maps">Maps</a>
        <a href="#coordinators">For coordinators</a>
      </nav>

      <section className="help-chapter" id="volunteers">
        <span className="chapter-tag tag-volunteer">Every volunteer</span>
        <h1>Get your pass, get scanned, get to your post</h1>

        <h2>Before event day — do this today</h2>
        <ol className="help-steps">
          <li>
            On your phone, open <a href="/pass">pistahan.vercel.app/pass</a>.
          </li>
          <li>
            Enter your <b>name</b> (first, last, or full), your <b>email</b>,
            or the <b>last 4 digits of your phone number</b>. If more than one
            volunteer matches, try your email or phone digits instead.
          </li>
          <li>
            Your pass appears: QR code, name, shirt size, team, post, and
            shift.
          </li>
          <li>
            <b>📸 Screenshot it.</b> Cell service near the route is unreliable
            — a screenshot always works.
          </li>
          <li>
            Sign the{' '}
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdsdFdlsNTljDAQsaHPbFtqoy-S9uStKbe5Z7jdK0CWgpAHPg/viewform?usp=dialog"
              target="_blank"
              rel="noreferrer"
            >
              <b>Volunteer Code of Conduct form</b>
            </a>{' '}
            — takes 2 minutes, required for every volunteer.
          </li>
        </ol>
        <div className="help-callout">
          The screenshot is the whole trick. Do it while you have good
          internet, not at 6am on Market Street.
        </div>

        <h2>On event day</h2>
        <ol className="help-steps">
          <li>
            Arrive at your <b>call time</b> — it’s on your pass.
          </li>
          <li>
            Join the check-in lane for your <b>event</b> — Parade, Festival,
            or Pistahan. It’s the first word of the Team line on your pass.
          </li>
          <li>
            Show your QR screenshot with <b>screen brightness up</b>.
          </li>
          <li>
            Beep! Grab your shirt at the shirt table just after the scanners,
            then head to your post.
          </li>
        </ol>

        <h2>If something goes wrong</h2>
        <ul className="help-list">
          <li>
            <b>Phone dead or no pass?</b> Give the scanner your last name —
            about 10 seconds.
          </li>
          <li>
            <b>QR won’t read?</b> Read out the short code printed under it
            (like <code>PST-4K7Q</code>) and they’ll type it in.
          </li>
          <li>
            <b>Not on the list?</b> Head to the <b>help desk</b> — separate
            from the lanes — and they’ll sort it out.
          </li>
        </ul>
      </section>

      <section className="help-chapter" id="maps">
        <span className="chapter-tag tag-volunteer">Maps</span>
        <h1>Know where you’re going</h1>
        <p className="help-sub">
          Tap a map to open it full-size — then 📸 screenshot the ones for
          your assignment, same trick as the pass.
        </p>
        <div className="maps-grid">
          {MAPS.map((m) => (
            <a key={m.file} className="map-link" href={m.file} target="_blank" rel="noreferrer">
              🗺️ {m.title}
            </a>
          ))}
        </div>
      </section>

      <section className="help-chapter" id="coordinators">
        <span className="chapter-tag tag-coordinator">
          Station coordinators
        </span>
        <h1>Run your lane at 18 seconds a person</h1>
        <p className="help-sub">
          For the Parade, Festival, and Pistahan lanes and the help desk. Your
          phone is the scanner; everything works offline.
        </p>

        <h2>Set up your phone — the night before</h2>
        <ol className="help-steps">
          <li>
            Open the <b>setup link</b> from Grace (it pre-fills the backend
            connection). Chrome on Android, Safari on iPhone.
          </li>
          <li>
            Pick your <b>station</b> (Parade / Festival / Pistahan / Help desk) and enter your
            name.
          </li>
          <li>
            Tap <b>Download roster</b>, wait for “✓ … volunteers loaded”, then{' '}
            <b>Start</b>.
          </li>
          <li>
            <b>Add to Home Screen</b> (Share menu) — keeps offline mode
            reliable.
          </li>
          <li>
            <b>Airplane-mode test:</b> flip airplane mode on and check someone
            in via Search. It must work instantly. Flip it back off — the test
            check-in syncs itself.
          </li>
          <li>
            Charge to 100% and pack a <b>power bank</b>.
          </li>
        </ol>

        <h2>Scanning — what each result means</h2>
        <div className="help-chips">
          <div className="chip-row">
            <span className="chip chip-ok">GREEN + BEEP</span>
            <p>
              Checked in. Call out the <b>shirt size</b> (it’s huge on
              screen), point them to their post. Next!
            </p>
          </div>
          <div className="chip-row">
            <span className="chip chip-warn">ALREADY CHECKED IN</span>
            <p>They’re fine — let them through.</p>
          </div>
          <div className="chip-row">
            <span className="chip chip-err">NOT ON ROSTER</span>
            <p>
              Send them to the <b>help desk</b>. Never solve it in the lane.
            </p>
          </div>
        </div>
        <div className="help-callout">
          The 20-second rule: anything longer than 20 seconds goes to the help
          desk. One 3-minute conversation puts your lane ten people behind.
        </div>

        <h2>When the QR won’t scan</h2>
        <ul className="help-list">
          <li>
            <b>Type the code</b> under their QR (like <code>PST-4K7Q</code>)
            into the box below the viewfinder.
          </li>
          <li>
            <b>No pass at all:</b> Search tab → last name → <b>Check in</b>.
            ~10 seconds.
          </li>
          <li>
            Glare or a dim screen? Tap the <b>🔦 torch</b>.
          </li>
        </ul>

        <h2>The status bar, decoded</h2>
        <ul className="help-list">
          <li>
            <code>126 / 194</code> — checked in so far, with a progress bar.
          </li>
          <li>
            <code>online · synced</code> — every check-in is in the Google
            Sheet.
          </li>
          <li>
            <code>offline · 4 queued</code> — <b>totally fine.</b> Check-ins
            are saved on the phone and upload themselves when signal returns.
            Never stop scanning because you’re offline. Tap the pill to force a
            sync.
          </li>
        </ul>

        <h2>Help desk only</h2>
        <ul className="help-list">
          <li>
            <b>Walk-up tab:</b> add people who aren’t on the roster — name,
            phone, shirt, post. Syncs automatically.
          </li>
        </ul>

        <h2>Troubleshooting</h2>
        <div className="help-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Problem</th>
                <th>Do this</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Camera won’t start</td>
                <td>Manual code entry, or the Search tab</td>
              </tr>
              <tr>
                <td>App won’t load</td>
                <td>Use the spare phone (already set up); ferry people to it</td>
              </tr>
              <tr>
                <td>“Backend is down!”</td>
                <td>
                  Irrelevant during the rush — everything queues locally.
                  Don’t stop to fix it.
                </td>
              </tr>
              <tr>
                <td>Wrong station or name</td>
                <td>
                  ⚙ gear → reset → set up again (roster and queued check-ins
                  are kept)
                </td>
              </tr>
              <tr>
                <td>Everything is on fire</td>
                <td>Paper roster + highlighter; reconcile after</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Never do</h2>
        <ul className="help-list">
          <li>Don’t hand your phone to volunteers.</li>
          <li>Don’t troubleshoot in the lane — that’s the help desk’s job.</li>
          <li>
            Don’t clear the browser’s website data — that deletes queued
            check-ins.
          </li>
        </ul>
      </section>

      <footer className="help-footer">
        Pistahan 33 · Filipino American Arts Exposition · Questions? Find
        Grace or the help desk. Salamat for volunteering! 🇵🇭
        <div className="credit">
          Developed with ❤️ by{' '}
          <a href="https://www.mgesteban.com" target="_blank" rel="noreferrer">
            www.mgesteban.com
          </a>
        </div>
      </footer>
    </main>
  )
}
