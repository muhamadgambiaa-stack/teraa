import { PolicyPage } from "@/components/PolicyPage";

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      lastUpdated="27 August 2026"
      intro="These terms explain the basic rules for using Teraa. By creating an account, listing a product, placing an order or otherwise using Teraa, you agree to follow these terms."
      sections={[
        {
          title: "1. What Teraa does",
          paragraphs: [
            "Teraa is a marketplace that helps people discover products and connect with buyers and sellers. Teraa provides the platform, marketplace tools and account features used to make those connections.",
            "Teraa does not currently hold customer money or operate an escrow service. Payments for current marketplace orders are made using cash on delivery.",
          ],
        },

        {
          title: "2. Your account",
          paragraphs: [
            "You are responsible for providing accurate information when creating and maintaining your Teraa account.",
            "You are responsible for activity carried out through your account. Do not give another person access to your account or use another person's account without permission.",
          ],
          items: [
            "Keep your account information accurate.",
            "Use a phone number and email address that belong to you.",
            "Do not impersonate another person or business.",
            "Do not create accounts for fraudulent or abusive purposes.",
          ],
        },

        {
          title: "3. Buying on Teraa",
          paragraphs: [
            "Buyers should review the product description, price, condition, seller information and delivery details before placing an order.",
            "For cash on delivery orders, buyers should inspect the item before paying whenever reasonably possible.",
          ],
          items: [
            "Do not place orders you have no genuine intention of completing.",
            "Provide accurate delivery information.",
            "Treat sellers respectfully.",
            "Report suspicious listings or conduct to Teraa.",
          ],
        },

        {
          title: "4. Selling on Teraa",
          paragraphs: [
            "Sellers are responsible for the products they list, including the accuracy of the title, description, photos, condition, price, stock and availability.",
            "Seller verification means Teraa has reviewed the identity or business information submitted by that seller. Verification does not mean that Teraa guarantees every product sold by that seller.",
          ],
          items: [
            "Only list products you are legally allowed to sell.",
            "Use genuine product photos and descriptions.",
            "Do not deliberately hide important defects or misleading information.",
            "Keep stock quantities reasonably accurate.",
            "Do not use Teraa to scam, deceive or harass another person.",
          ],
        },

        {
          title: "5. Orders and cash on delivery",
          paragraphs: [
            "Teraa currently supports cash on delivery as the active checkout method. Online payments may be introduced later.",
            "The buyer and seller are responsible for completing the physical exchange and cash payment. Buyers should inspect the item before paying where possible.",
            "An order marked completed means the marketplace order workflow has been completed. It does not create a separate financial guarantee from Teraa.",
          ],
        },

        {
          title: "6. Cancellations",
          paragraphs: [
            "Eligible orders may be cancelled before they progress too far through the delivery process. Teraa may limit cancellation options once an order has been shipped or delivered.",
            "Repeated abusive ordering or cancellation may lead to account restrictions if it appears that the marketplace is being intentionally misused.",
          ],
        },

        {
          title: "7. Reviews",
          paragraphs: [
            "Reviews should describe a buyer's genuine experience with the product purchased through Teraa.",
            "Teraa may remove reviews that are fraudulent, abusive, unrelated to the product or otherwise violate marketplace rules.",
          ],
        },

        {
          title: "8. Marketplace moderation",
          paragraphs: [
            "Teraa may remove listings, restrict accounts, suspend sellers or ban users where there is evidence of fraud, prohibited products, repeated abuse, serious safety concerns or violations of these terms.",
            "Sellers may be given an opportunity to appeal certain listing moderation decisions through Teraa's appeal system.",
          ],
        },

        {
          title: "9. Things you must not do",
          items: [
            "Use Teraa for fraud or scams.",
            "Sell stolen, illegal, counterfeit or prohibited goods.",
            "Post false or deliberately misleading listings.",
            "Harass, threaten or impersonate other users.",
            "Attempt to bypass Teraa security or gain access to another person's account.",
            "Upload malicious files or interfere with the operation of the platform.",
            "Use automated systems to abuse Teraa or collect private user information.",
          ],
        },

        {
          title: "10. Marketplace transactions",
          paragraphs: [
            "Teraa helps buyers and sellers connect, but the seller remains responsible for the product being sold and the buyer remains responsible for deciding whether to complete the purchase.",
            "Teraa cannot guarantee that every listing, buyer, seller or transaction will be free from risk. Users should use reasonable care, inspect products and report suspicious activity.",
          ],
        },

        {
          title: "11. Changes to Teraa",
          paragraphs: [
            "Teraa may add, remove or change marketplace features as the service develops. This includes payment methods, delivery tools, account features, fees and moderation systems.",
            "If Teraa introduces fees or commissions in the future, users will be informed before those charges become applicable.",
          ],
        },

        {
          title: "12. Changes to these terms",
          paragraphs: [
            "These terms may be updated as Teraa grows. Important changes may be communicated through the app or other reasonable means.",
            "Continuing to use Teraa after updated terms take effect means you agree to the updated terms.",
          ],
        },
      ]}
    />
  );
}
