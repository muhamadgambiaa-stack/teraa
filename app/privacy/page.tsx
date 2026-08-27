import { PolicyPage } from "@/components/PolicyPage";

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      lastUpdated="27 August 2026"
      intro="This policy explains what information Teraa collects, why we use it and how marketplace information may be shown to other users."
      sections={[
        {
          title: "1. Information you give Teraa",
          paragraphs: [
            "When you create or use a Teraa account, you may provide information such as your name, email address, phone number, city and account preferences.",
          ],
          items: [
            "Name",
            "Email address",
            "Phone number",
            "City or location",
            "Account role",
            "Seller business information",
            "Product listings and photos",
            "Order and delivery information",
            "Reviews, reports and appeals",
          ],
        },

        {
          title: "2. Seller verification information",
          paragraphs: [
            "Sellers may be asked to provide identity or business documents for verification.",
            "Verification documents are used for marketplace trust and moderation. They are not intended to be publicly displayed on seller profiles.",
          ],
        },

        {
          title: "3. Information other users can see",
          paragraphs: [
            "Some marketplace information is public because buyers need it to evaluate listings and sellers.",
          ],
          items: [
            "Seller or shop name",
            "Seller profile photo or shop banner where provided",
            "Seller city",
            "Verification status",
            "Shop description",
            "Active product listings",
            "Completed sales information shown by Teraa",
            "Product reviews",
          ],
        },

        {
          title: "4. Information Teraa keeps private",
          paragraphs: [
            "Teraa does not intentionally display private account information publicly unless it is needed for a specific marketplace function.",
          ],
          items: [
            "Passwords and authentication credentials",
            "Seller identity documents",
            "Private purchase history",
            "Administrative moderation information",
            "Private account data that is not part of a public profile",
          ],
        },

        {
          title: "5. How we use information",
          items: [
            "Create and maintain Teraa accounts.",
            "Allow buyers and sellers to use marketplace features.",
            "Process marketplace orders.",
            "Coordinate delivery information.",
            "Verify sellers.",
            "Prevent fraud and abuse.",
            "Investigate reports and appeals.",
            "Send account and marketplace notifications.",
            "Improve Teraa's reliability, safety and user experience.",
          ],
        },

        {
          title: "6. Orders and contact information",
          paragraphs: [
            "Certain information may be shared with the other party to an order when it is necessary to complete the transaction or delivery.",
            "For example, a seller may need buyer contact or delivery information to complete an accepted order.",
          ],
        },

        {
          title: "7. Service providers",
          paragraphs: [
            "Teraa uses technology providers to operate the marketplace. These may include hosting, database, authentication and storage providers.",
            "Teraa currently uses services such as Supabase and Vercel as part of its technical infrastructure.",
          ],
        },

        {
          title: "8. Security",
          paragraphs: [
            "Teraa uses technical protections such as authentication, database access controls and Row Level Security to reduce unauthorized access.",
            "No internet service can guarantee perfect security. Users should protect their login information and report suspected account misuse promptly.",
          ],
        },

        {
          title: "9. How long information is kept",
          paragraphs: [
            "Teraa may retain account, transaction, moderation and security records for as long as reasonably needed to operate the marketplace, resolve disputes, prevent abuse and comply with applicable requirements.",
          ],
        },

        {
          title: "10. Account changes and deletion",
          paragraphs: [
            "Users may update certain account information from their Teraa account page.",
            "As Teraa develops, additional account deletion and privacy controls may be introduced. Some transaction or moderation records may need to be retained even after an account is closed.",
          ],
        },

        {
          title: "11. Changes to this policy",
          paragraphs: [
            "Teraa may update this Privacy Policy as the marketplace changes. Important changes may be communicated through the app.",
          ],
        },
      ]}
    />
  );
}
