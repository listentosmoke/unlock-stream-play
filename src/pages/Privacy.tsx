import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Privacy Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
              <div className="text-sm text-muted-foreground text-center mb-8">
                Last updated: {new Date().toLocaleDateString()}
              </div>

              <section>
                <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                <p className="mb-3">We collect the following types of information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Email address, username, and password</li>
                  <li><strong>Profile Information:</strong> Display name, avatar, and other profile details you provide</li>
                  <li><strong>Content:</strong> Videos, comments, and other content you upload or share</li>
                  <li><strong>Usage Data:</strong> How you interact with our platform, including views and interactions</li>
                  <li><strong>Technical Data:</strong> IP address, browser type, device information, and cookies</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                <p className="mb-3">We use your information to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide and maintain our video streaming service</li>
                  <li>Create and manage your account</li>
                  <li>Process and deliver content you upload</li>
                  <li>Communicate with you about our service</li>
                  <li>Improve our platform and user experience</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
                <p className="mb-3">We may share your information in the following circumstances:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Public Content:</strong> Content you choose to make public will be visible to other users</li>
                  <li><strong>Service Providers:</strong> With third-party services that help us operate our platform</li>
                  <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                  <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                </ul>
                <p className="mt-3">
                  <strong>We do not sell your personal information to third parties.</strong>
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. User-Generated Content Disclaimer</h2>
                <p className="mb-3">
                  <strong>IMPORTANT:</strong> Our platform allows users to upload and share content. Please be aware that:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>User-generated content is not controlled or monitored by LockedContent in real-time</li>
                  <li>We are not responsible for the privacy practices of other users</li>
                  <li>Content you upload may be viewed by other users according to your privacy settings</li>
                  <li>We cannot guarantee the privacy or security of information shared in user-generated content</li>
                  <li>You are responsible for what you choose to share and with whom</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
                <p>
                  We implement appropriate security measures to protect your personal information. However, 
                  no method of transmission over the internet is 100% secure. We cannot guarantee absolute security 
                  of your data.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
                <p>
                  We retain your personal information for as long as necessary to provide our services and 
                  comply with legal obligations. You may request deletion of your account and associated data 
                  at any time.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
                <p className="mb-3">You have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access and update your personal information</li>
                  <li>Delete your account and associated data</li>
                  <li>Control your privacy settings</li>
                  <li>Opt out of certain communications</li>
                  <li>Export your data in a portable format</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
                <p>
                  We use cookies and similar technologies to enhance your experience, analyze usage, and 
                  provide personalized content. You can control cookie settings through your browser.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Third-Party Services</h2>
                <p>
                  Our platform may integrate with third-party services. This privacy policy does not cover 
                  the privacy practices of third-party services. Please review their privacy policies separately.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
                <p>
                  Our service is not intended for children under 13 years of age. We do not knowingly collect 
                  personal information from children under 13.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
                <p>
                  We may update this privacy policy from time to time. We will notify you of any material 
                  changes by posting the new policy on our platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy or our data practices, please contact us 
                  through our platform.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}