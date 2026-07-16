import React from 'react';
import { Link } from 'react-router-dom';

// TODO before public launch: set these to your real controller name + a real
// contact address (you do not own mindspace.app). Kept identical to the
// Privacy Policy so the two pages stay in sync.
const CONTROLLER = 'Mindspace';
const CONTACT = 'privacy@mindspace.app';
const EFFECTIVE_DATE = '16 July 2026';
const MIN_AGE = 18;
const GOVERNING_LAW = 'England and Wales';

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

const TermsOfService = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      <div style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: 'var(--spacing-lg)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-xxl)', marginBottom: 'var(--spacing-sm)' }}>Terms of Service</h1>
        <p style={{ opacity: 0.9 }}>The terms on which you use Mindspace. Effective {EFFECTIVE_DATE}.</p>
      </div>

      <main id="main-content" className="container" style={{ maxWidth: '900px', paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xxl)' }}>
        <div className="card" style={{ padding: 'var(--spacing-xl)' }}>

          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)', lineHeight: 1.7 }}>
            These terms govern your use of Mindspace. By creating an account or
            using the app you agree to them. If you do not agree, please do not
            use Mindspace.
          </p>

          <div className="alert alert-warning" role="note" style={{ marginBottom: 'var(--spacing-xl)' }}>
            <strong>Mindspace is not a medical service.</strong> It is a self-help
            wellbeing tool, not a medical device, a diagnosis, or a substitute for
            professional care, and the Luna assistant is not a clinician. Do not
            rely on Mindspace in an emergency. If you are in crisis or need urgent
            help, contact your GP, call NHS 111, call the Samaritans on 116 123,
            or in an emergency call 999. See our{' '}
            <Link to="/crisis-resources" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>crisis support resources</Link>.
          </div>

          <Section title="1. Who provides Mindspace">
            <p>
              Mindspace is provided by {CONTROLLER} ("we", "us"). You can contact
              us at <a href={`mailto:${CONTACT}`} style={{ color: 'var(--primary-color)' }}>{CONTACT}</a>.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least {MIN_AGE} years old to use Mindspace. By using
              it you confirm that you meet this requirement.
            </p>
          </Section>

          <Section title="3. What Mindspace is (and is not)">
            <p>
              Mindspace helps you record and reflect on your wellbeing, complete
              self-assessment questionnaires, and use optional supportive features.
              It provides information and self-help tools only. It does not provide
              medical advice, diagnosis, or treatment, and nothing in the app
              creates a clinician-patient relationship. Automated features,
              including forecasts, insights, and the Luna assistant, can be
              inaccurate and must not be relied on for clinical or safety
              decisions.
            </p>
          </Section>

          <Section title="4. Your account">
            <p>
              You are responsible for keeping your login details secure and for
              activity under your account. Provide accurate information, and let us
              know promptly if you believe your account has been compromised.
            </p>
          </Section>

          <Section title="5. Acceptable use">
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: '1.2rem', display: 'grid', gap: '0.35rem' }}>
              <li>use Mindspace unlawfully, or to harm, harass, or abuse others (including in any peer-support features);</li>
              <li>attempt to access other users' data, or to breach, probe, or disrupt the security or availability of the service;</li>
              <li>upload malicious code, scrape the service, or misuse automated access;</li>
              <li>impersonate anyone or misrepresent your affiliation.</li>
            </ul>
            <p>
              In shared or peer features, be respectful. We may remove content or
              suspend accounts that breach these terms.
            </p>
          </Section>

          <Section title="6. Your content and data">
            <p>
              You keep ownership of the content and data you submit (your entries,
              notes, and responses). You grant us only the permission needed to
              store and process that content to provide the service to you, as
              described in our{' '}
              <Link to="/privacy" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Privacy Policy</Link>.
              You can export or delete your data at any time.
            </p>
          </Section>

          <Section title="7. The software">
            <p>
              Mindspace is open-source software made available under the MIT
              Licence. The licence covers the source code; it does not grant any
              right to our name, branding, or any hosted service or data.
            </p>
          </Section>

          <Section title="8. Privacy">
            <p>
              Our handling of your personal data is described in the{' '}
              <Link to="/privacy" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Privacy Policy</Link>,
              which forms part of these terms.
            </p>
          </Section>

          <Section title="9. Availability and changes">
            <p>
              We aim to keep Mindspace available but do not guarantee
              uninterrupted access, and we may change, suspend, or discontinue
              features at any time. We may update these terms; material changes
              will be notified in the app and the effective date above will change.
            </p>
          </Section>

          <Section title="10. Disclaimers">
            <p>
              Mindspace is provided "as is" and "as available", without warranties
              of any kind, whether express or implied, to the fullest extent
              permitted by law. We do not warrant that the app, its insights, or
              its automated features are accurate, reliable, or fit for any
              particular purpose.
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              To the fullest extent permitted by law, we are not liable for any
              indirect or consequential loss, or for any decision you make in
              reliance on the app. Nothing in these terms excludes or limits
              liability that cannot be excluded or limited under applicable law,
              including liability for death or personal injury caused by
              negligence. Mindspace does not replace professional or emergency
              care (see the notice above).
            </p>
          </Section>

          <Section title="12. Termination">
            <p>
              You can stop using Mindspace and delete your account at any time. We
              may suspend or end your access if you breach these terms or to
              protect the service or other users.
            </p>
          </Section>

          <Section title="13. Governing law">
            <p>
              These terms are governed by the laws of {GOVERNING_LAW}, and the
              courts of {GOVERNING_LAW} have exclusive jurisdiction, subject to any
              mandatory rights you have as a consumer in your place of residence.
            </p>
          </Section>

          <Section title="14. Contact">
            <p>
              {CONTROLLER} — <a href={`mailto:${CONTACT}`} style={{ color: 'var(--primary-color)' }}>{CONTACT}</a>.
            </p>
          </Section>

          <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-primary">Back to home</Link>
            <Link to="/privacy" className="btn btn-secondary">Privacy Policy</Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
