import { PolicyPage } from "@/components/PolicyPage";

export default function SafetyPage() {
  return (
    <PolicyPage
      title="Safety on Teraa"
      lastUpdated="27 August 2026"
      intro="Buying and selling with other people always requires some care. These tips are here to help you use Teraa more safely."
      sections={[
        {
          title: "Verified sellers",
          paragraphs: [
            "A verified seller has submitted identification or business information that was reviewed by Teraa.",
            "Verification helps us confirm who is behind a seller account, but it does not guarantee the quality, condition or authenticity of every product they list.",
          ],
        },

        {
          title: "Cash on delivery",
          paragraphs: [
            "Cash on delivery is currently the active payment method on Teraa.",
            "Online payments through mobile money or bank transfer are not currently available through Teraa checkout.",
          ],
          items: [
            "Inspect the item before handing over cash whenever possible.",
            "Make sure the product matches the listing description.",
            "For electronics, test the basic functions before paying where practical.",
            "Do not feel pressured to complete a purchase if the product is significantly different from what was advertised.",
          ],
        },

        {
          title: "Meeting a buyer or seller",
          items: [
            "Meet in a busy, public and well-lit place.",
            "Avoid isolated locations when meeting someone you do not know.",
            "Tell someone where you are going for higher-value transactions.",
            "Consider bringing another person with you for expensive purchases.",
            "Do not carry more cash than you need for the transaction.",
          ],
        },

        {
          title: "Watch for warning signs",
          items: [
            "A price that is unusually low compared with the normal market price.",
            "A seller refusing to let you reasonably inspect the item.",
            "Someone pressuring you to complete the transaction immediately.",
            "Photos or descriptions that do not match what you are shown.",
            "Someone asking you to ignore the normal Teraa order process.",
            "Requests for passwords, email verification codes or other sensitive account information.",
          ],
        },

        {
          title: "Protect your account",
          items: [
            "Never share your Teraa password.",
            "Never share email verification codes with another person.",
            "Use an email account that only you control.",
            "Log out when using a device that other people can access.",
            "Report suspected account misuse as soon as possible.",
          ],
        },

        {
          title: "Reporting a listing",
          paragraphs: [
            "If a listing looks fraudulent, prohibited or misleading, use the Report this listing option on the product page.",
            "Teraa administrators can review reports, remove listings and restrict accounts when appropriate.",
          ],
        },

        {
          title: "If something feels wrong",
          paragraphs: [
            "You are not required to complete a transaction simply because you placed an order.",
            "If the meeting feels unsafe or the item is materially different from the listing, prioritize your safety and do not continue with the transaction.",
          ],
        },

        {
          title: "What Teraa does not currently provide",
          paragraphs: [
            "Teraa does not currently hold customer payments, provide escrow or operate a buyer-protection refund system.",
            "For cash on delivery orders, the buyer and seller complete the exchange directly. Buyers should inspect the item before paying whenever possible.",
          ],
        },
      ]}
    />
  );
}
