import { PolicyPage } from "@/components/PolicyPage";

export default function MarketplaceRulesPage() {
  return (
    <PolicyPage
      title="Marketplace Rules"
      lastUpdated="27 August 2026"
      intro="These rules are here to keep Teraa useful and safe for buyers and sellers. Everyone who lists, buys or sells through Teraa is expected to follow them."
      sections={[
        {
          title: "Be honest about what you sell",
          items: [
            "Use accurate titles, descriptions and photos.",
            "Clearly describe whether an item is new or used.",
            "Tell buyers about important defects or damage.",
            "Do not advertise an item that you do not actually have available.",
            "Keep prices and stock reasonably accurate.",
          ],
        },

        {
          title: "Prohibited items",
          paragraphs: [
            "Do not use Teraa to advertise or sell goods that are illegal, dangerous or inappropriate for a general marketplace.",
          ],
          items: [
            "Illegal drugs or controlled substances.",
            "Firearms, ammunition, explosives or prohibited weapons.",
            "Stolen goods.",
            "Counterfeit or intentionally fake branded goods.",
            "Pornographic or sexually explicit products.",
            "Fraudulent documents, fake IDs or forged certificates.",
            "Dangerous chemicals or hazardous materials intended to cause harm.",
            "Human body parts or other unlawful biological material.",
            "Any product that is illegal to buy, sell or possess under applicable law.",
          ],
        },

        {
          title: "Restricted products",
          paragraphs: [
            "Some categories may require additional rules, verification or approval before Teraa allows them to be listed. Teraa may remove a listing if we believe extra checks are necessary.",
          ],
        },

        {
          title: "No scams or misleading listings",
          items: [
            "Do not ask buyers to pay for products that do not exist.",
            "Do not pretend to represent another person or business.",
            "Do not use stolen product photos to mislead buyers.",
            "Do not deliberately misrepresent the condition, brand or origin of a product.",
            "Do not create fake orders, fake reviews or fake reports.",
          ],
        },

        {
          title: "Respect other users",
          items: [
            "Do not threaten, harass or insult other users.",
            "Do not misuse another person's phone number or personal information.",
            "Do not repeatedly place fake orders.",
            "Do not abuse Teraa's reporting or appeal tools.",
          ],
        },

        {
          title: "Seller responsibility",
          paragraphs: [
            "Sellers remain responsible for the products they offer and for complying with any laws or regulations that apply to those products.",
            "A verified seller badge confirms that Teraa reviewed identification or business information. It does not mean that Teraa guarantees every product offered by that seller.",
          ],
        },

        {
          title: "Moderation",
          paragraphs: [
            "Teraa may hide or remove listings that appear to violate marketplace rules.",
            "Serious or repeated violations may result in account restrictions, suspension or a permanent ban.",
            "Where available, sellers may use Teraa's listing appeal system to request another review after correcting a moderated listing.",
          ],
        },

        {
          title: "Report problems",
          paragraphs: [
            "If you see a suspicious, prohibited or misleading listing, use the report option on the product page. Reports help Teraa investigate marketplace problems before they affect more users.",
          ],
        },
      ]}
    />
  );
}
