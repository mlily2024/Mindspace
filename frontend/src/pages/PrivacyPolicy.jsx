import React from 'react';
import { Link } from 'react-router-dom';

// TODO before public launch: set these to your real controller name + a real
// privacy contact address (you do not own mindspace.app). A dedicated inbox is
// preferable to a personal one. These two constants are the only things that
// need changing here.
const CONTROLLER = 'Mindspace';
const PRIVACY_CONTACT = 'privacy@mindspace.app';
const EFFECTIVE_DATE = '16 July 2026';
const MIN_AGE = 18;
const DATA_REGION = 'United States';

const Section = ({ title, children }) => (
  <section style={{ marginBottom: 'var(--spacing-xl)' }}>
    <h2 style={{ color: 'var(--primary-color)', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-xl)' }}>
      {title}
    </h2>
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, display: 'grid', gap: 'var(--spacing-sm)' }}>
      {children}
    </div>
  </section>
);

const PrivacyPolicy = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      <div style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: 'var(--spacing-lg)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-xxl)', marginBottom: 'var(--spacing-sm)' }}>Privacy Policy</h1>
        <p style={{ opacity: 0.9 }}>How Mindspace looks after your data. Effective {EFFECTIVE_DATE}.</p>
      </div>

      <main id="main-content" className="container" style={{ maxWidth: '900px', paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xxl)' }}>
        <div className="card" style={{ padding: 'var(--spacing-xl)' }}>

          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)', lineHeight: 1.7 }}>
            Mindspace is a privacy-first mental-health tracking application. This
            policy explains what personal data we collect, why, how it is
            protected, who it is (and is not) shared with, and the rights you have
            under UK data-protection law (UK GDPR and the Data Protection Act 2018).
          </p>

          <Section title="1. Who we are">
            <p>
              The data controller responsible for your personal data is {CONTROLLER}
              {' '}("we", "us"). You can contact us about privacy at{' '}
              <a href={`mailto:${PRIVACY_CONTACT}`} style={{ color: 'var(--primary-color)' }}>{PRIVACY_CONTACT}</a>.
            </p>
          </Section>

          <Section title="2. The data we collect">
            <ul style={{ paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
              <li><strong>Account data:</strong> your email address and a securely hashed password.</li>
              <li><strong>Wellbeing data you enter:</strong> mood entries and ratings, journal notes, responses to validated questionnaires (for example PHQ-9, GAD-7, PSS-4, WEMWBS, ISI), and any emergency contact you add.</li>
              <li><strong>Luna chat:</strong> the messages you exchange with the in-app assistant.</li>
              <li><strong>Voice check-ins (optional):</strong> audio is processed on your device to derive acoustic features. The raw audio is never uploaded; only the derived numeric features are stored.</li>
              <li><strong>Peer support (optional):</strong> messages and responses you choose to share.</li>
              <li><strong>Technical data:</strong> minimal logs needed to run and secure the service, and an integrity-protected audit log of automated actions on your account.</li>
            </ul>
            <p>Much of this is <strong>special-category health data</strong>, which we treat accordingly (see section 4).</p>
          </Section>

          <Section title="3. Why we use your data">
            <p>
              To provide the service you have asked for: recording and displaying
              your wellbeing over time, generating your personal insights and
              forecasts, running the assessments and interventions you choose to
              use, operating the Luna assistant, keeping your account secure, and
              meeting our legal obligations.
            </p>
          </Section>

          <Section title="4. Legal basis">
            <ul style={{ paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
              <li>Providing the core service to you: <strong>performance of a contract</strong> (Article 6(1)(b) UK GDPR).</li>
              <li>Processing your <strong>health data</strong>: your <strong>explicit consent</strong> (Article 9(2)(a)), given by choosing to enter that data and withdrawable at any time by deleting the data or your account.</li>
              <li>Security and legal compliance: our <strong>legitimate interests</strong> and <strong>legal obligations</strong> (Article 6(1)(c) and (f)).</li>
            </ul>
          </Section>

          <Section title="5. How your data is protected">
            <p>Privacy is built into the design, not added on top:</p>
            <ul style={{ paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
              <li><strong>Encryption at rest:</strong> journal notes are encrypted with AES-256-GCM. You can additionally enable client-side end-to-end encryption, so notes are encrypted on your device before they reach our servers.</li>
              <li><strong>On-device processing:</strong> sentiment analysis and voice-feature extraction run in your browser on your device. The underlying text and audio are not sent to us for that processing.</li>
              <li><strong>Differential privacy:</strong> any cohort or aggregate statistics use differential privacy so no individual can be identified from them.</li>
              <li><strong>Audit integrity:</strong> automated actions on your account are recorded in a tamper-evident, hash-chained audit log.</li>
              <li><strong>Access control:</strong> authentication uses signed tokens; sensitive routes are rate-limited and protected by standard security headers.</li>
            </ul>
          </Section>

          <Section title="6. When data leaves your device, and who processes it">
            <p>We use a small number of service providers ("processors") who act only on our instructions:</p>
            <ul style={{ paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
              <li><strong>Application hosting:</strong> Render hosts the application.</li>
              <li><strong>Database hosting:</strong> Neon stores your data, held in the {DATA_REGION} region.</li>
              <li><strong>Assistant (Luna) language model, optional and off by default:</strong> Luna runs in a rule-based, on-device mode by default, and no chat content leaves our systems in that mode. An external AI provider (Anthropic) is used only if the operator has enabled it and you have separately opted in; in that case your chat messages are sent to Anthropic to generate a reply, after a local safety check. You can decline or withdraw this at any time in your settings.</li>
              <li><strong>Push notifications, optional:</strong> if you enable notifications, your browser's push service delivers them.</li>
            </ul>
            <p>We do <strong>not</strong> sell your data, use it for advertising, or share it for anyone else's marketing.</p>
          </Section>

          <Section title="7. What we do not do">
            <ul style={{ paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
              <li>No third-party analytics, advertising, or behavioural-tracking services.</li>
              <li>No selling or renting of personal data.</li>
              <li>No cross-site tracking cookies.</li>
            </ul>
          </Section>

          <Section title="8. Cookies and local storage">
            <p>
              Mindspace uses your browser's local storage to keep you signed in
              (your authentication token) and to remember a few interface
              preferences. These are strictly necessary for the app to function
              and are not used to track you across other websites.
            </p>
          </Section>

          <Section title="9. How long we keep your data">
            <p>
              We keep your data for as long as your account is active. If you
              delete an entry it is removed; if you delete your account, your
              personal data is deleted. Minimal security logs may be retained
              briefly where we are legally required to do so.
            </p>
          </Section>

          <Section title="10. Your rights">
            <p>
              Under UK GDPR you have the right to access your data, correct it,
              delete it (you can delete your account in-app), export it (data
              portability), restrict or object to processing, and withdraw consent
              at any time. Exercising these rights is free and we will respond
              within one month. To make a request, use the in-app controls or
              email <a href={`mailto:${PRIVACY_CONTACT}`} style={{ color: 'var(--primary-color)' }}>{PRIVACY_CONTACT}</a>.
            </p>
            <p>
              If you are unhappy with how we handle your data, you can complain to
              the UK Information Commissioner's Office (ICO) at{' '}
              <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>ico.org.uk</a>.
            </p>
          </Section>

          <Section title={`11. Children`}>
            <p>
              Mindspace is not intended for use by anyone under {MIN_AGE}. We do
              not knowingly collect data from children.
            </p>
          </Section>

          <div className="alert alert-warning" role="note" style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
            <strong>Important: Mindspace is not a medical service.</strong> It is a
            self-help wellbeing tool, not a medical device, a diagnosis, or a
            substitute for professional care, and Luna is not a clinician. If you
            are in crisis or need urgent help, contact your GP, call NHS 111, call
            the Samaritans on 116 123, or in an emergency call 999. See our{' '}
            <Link to="/crisis-resources" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>crisis support resources</Link>.
          </div>

          <Section title="12. Changes to this policy">
            <p>
              We may update this policy. Material changes will be notified in the
              app, and the effective date above will change.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              {CONTROLLER} — <a href={`mailto:${PRIVACY_CONTACT}`} style={{ color: 'var(--primary-color)' }}>{PRIVACY_CONTACT}</a>.
            </p>
          </Section>

          <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-primary">Back to home</Link>
            <Link to="/terms" className="btn btn-secondary">Terms of Service</Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
