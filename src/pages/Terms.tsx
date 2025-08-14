import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Terms of Service
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
              <div className="text-sm text-muted-foreground text-center mb-8">
                Last updated: {new Date().toLocaleDateString()}
              </div>

              <section>
                <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                <p>
                  By creating an account and using StreamPlay, you agree to be bound by these Terms of Service. 
                  If you do not agree to these terms, please do not use our service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. User-Generated Content</h2>
                <p className="mb-3">
                  StreamPlay allows users to upload and share video content. By using our platform, you acknowledge and agree that:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You are solely responsible for any content you upload, share, or post on our platform</li>
                  <li>StreamPlay is not responsible for user-generated content and does not endorse, support, or guarantee the accuracy of any user content</li>
                  <li>You must have all necessary rights and permissions to upload and share your content</li>
                  <li>You will not upload content that is illegal, harmful, threatening, abusive, defamatory, or violates any laws</li>
                  <li>You will not upload copyrighted material without proper authorization</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Platform Disclaimer</h2>
                <p className="mb-3">
                  <strong>IMPORTANT:</strong> StreamPlay operates as a platform that enables users to share content with each other. 
                  We do not pre-screen, monitor, or control user-generated content. Therefore:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>StreamPlay is not liable for any user-generated content posted on our platform</li>
                  <li>We do not guarantee the accuracy, completeness, or quality of user content</li>
                  <li>Users interact with content at their own risk</li>
                  <li>We reserve the right to remove content that violates our terms, but we are under no obligation to monitor all content</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Prohibited Uses</h2>
                <p>You agree not to use StreamPlay to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Upload or share illegal, harmful, or inappropriate content</li>
                  <li>Violate any local, state, national, or international law</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Harass, abuse, or harm other users</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Account Responsibility</h2>
                <p>
                  You are responsible for maintaining the confidentiality of your account and password. 
                  You agree to accept responsibility for all activities that occur under your account.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
                <p>
                  StreamPlay shall not be liable for any indirect, incidental, special, consequential, or punitive damages 
                  resulting from your use of our service or any user-generated content on our platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Content Moderation</h2>
                <p>
                  While we may review and remove content that violates our terms, we are not obligated to monitor all content. 
                  Users are encouraged to report inappropriate content through our reporting mechanisms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these terms at any time. Continued use of StreamPlay after changes 
                  constitutes acceptance of the new terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
                <p>
                  We reserve the right to terminate or suspend accounts that violate these terms or engage in 
                  prohibited activities.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Contact Information</h2>
                <p>
                  If you have questions about these Terms of Service, please contact us through our platform.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}