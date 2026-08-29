import { PolicyPage } from "@/components/PolicyPage";

export default function SellerTermsPage() {
  return (
    <PolicyPage
      title="Teraa Seller Terms"
      intro="These terms apply to anyone who registers, operates or attempts to operate a seller account on Teraa."
      lastUpdated="August 30, 2026"
      sections={[
        {
          title: "1. Seller identity",
          items: [
            "You must provide truthful and accurate information when registering as a seller.",
            "Your legal name must match the identity document submitted for verification.",
            "Teraa may request additional identity or business information before or after approval.",
            "You may not use another person's identity or document to operate a seller account.",
          ],
        },
        {
          title: "2. Business and display name",
          items: [
            "Your business or display name is the name buyers see on Teraa.",
            "A display name must not impersonate another person, business or organization.",
            "Teraa may require a misleading, abusive or prohibited seller name to be changed.",
          ],
        },
        {
          title: "3. Seller approval",
          items: [
            "Submitting an application does not guarantee approval.",
            "A seller may only publish products after Teraa approves the seller verification.",
            "Teraa may reject, suspend or request additional verification where necessary to protect the marketplace.",
          ],
        },
        {
          title: "4. Teraa commission",
          paragraphs: [
            "Teraa may charge a commission on successfully completed marketplace transactions. The applicable commission and amount owed will be shown to the seller through Teraa.",
          ],
          items: [
            "Commission becomes payable only on transactions treated by Teraa as successfully completed.",
            "The commission rate recorded for a completed transaction remains attached to that transaction even if Teraa changes its rate later.",
            "A seller is responsible for paying all valid outstanding Teraa commission.",
          ],
        },
        {
          title: "5. Commission payment deadline",
          paragraphs: [
            "Where a completed transaction creates a commission balance, the seller must act on the payment within the deadline displayed by Teraa.",
          ],
          items: [
            "The standard commission action period is six hours after a transaction becomes completed.",
            "If the seller requests Teraa payment details before the deadline, time spent waiting for Teraa to respond will not count against the seller.",
            "Once Teraa provides payment instructions, the seller must follow the new payment deadline shown by Teraa.",
            "Uploading payment proof pauses enforcement while Teraa reviews that proof.",
          ],
        },
        {
          title: "6. Unpaid commission",
          items: [
            "If commission remains overdue without a valid pending payment request or payment review, Teraa may temporarily pause the seller's selling privileges.",
            "When selling privileges are paused for unpaid commission, the seller's marketplace listings may stop appearing to buyers.",
            "Listings are not necessarily deleted when selling privileges are paused.",
            "Selling privileges may be restored after Teraa confirms payment of the required commission.",
          ],
        },
        {
          title: "7. Payment proof",
          items: [
            "Payment proof must relate to the payment actually made by the seller.",
            "Submitting altered, false or unrelated payment evidence may lead to suspension or permanent seller restrictions.",
            "Teraa may reject unclear or unverifiable proof and request a clearer document.",
          ],
        },
        {
          title: "8. Duplicate and replacement accounts",
          items: [
            "Creating another account does not erase unpaid commission, restrictions or serious seller violations.",
            "Teraa may use identity information and secure fraud-prevention signals to identify possible repeat seller registrations.",
            "A possible identity match may be flagged for administrator review rather than automatically approved.",
          ],
        },
        {
          title: "9. Listings and transactions",
          items: [
            "Sellers must accurately describe products, prices, condition and availability.",
            "Sellers must not list prohibited, illegal, counterfeit or misleading products.",
            "Sellers are responsible for fulfilling confirmed transactions and communicating appropriately with buyers.",
            "Marketplace Rules and Teraa's general Terms of Service also apply to seller activity.",
          ],
        },
        {
          title: "10. Enforcement",
          items: [
            "Teraa may restrict seller features, hide listings, request verification, suspend or ban a seller where marketplace rules are violated.",
            "Where an appeal or review process is available, the seller may use that process to provide additional information.",
          ],
        },
      ]}
    />
  );
}