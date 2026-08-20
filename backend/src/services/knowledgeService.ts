// src/services/knowledgeService.ts
// GST Statutory Knowledge Layer & Semantic Vector Retrieval Engine (RAG)
// Covers CGST/SGST Acts, Section 16, Section 17(5), Rule 88A, Rule 86B, Section 50, and RCM

import { query } from "../lib/db.js";

export interface GSTKnowledgeItem {
  id?: string;
  section_title: string;
  source_act: "CGST_ACT" | "SGST_ACT" | "IGST_ACT" | "RULES" | "CIRCULAR" | "HSN_GUIDE";
  section_number: string;
  category: "ITC_ELIGIBILITY" | "BLOCKED_CREDIT" | "SET_OFF_RULES" | "RCM" | "INVOICE_RULES" | "INTEREST_PENALTY";
  content: string;
  legal_rule_metadata: {
    is_blocked_credit?: boolean;
    sub_clause?: string;
    exceptions?: string[];
    mandatory_cash_percent?: number;
    interest_rate_percent?: number;
    keywords?: string[];
  };
}

// Pre-seeded statutory tax knowledge base (GST Acts & Rules)
export const STATUTORY_TAX_KNOWLEDGE: GSTKnowledgeItem[] = [
  {
    section_title: "Eligibility and conditions for taking input tax credit",
    source_act: "CGST_ACT",
    section_number: "16",
    category: "ITC_ELIGIBILITY",
    content: `Under Section 16 of the CGST Act, every registered person is entitled to take credit of input tax charged on any supply of goods or services used in the course or furtherance of business. Conditions: (1) Possession of a tax invoice or debit note issued by a registered supplier; (2) Receipt of goods or services; (3) Tax charged in respect of such supply has been actually paid to the Government; (4) Return under Section 39 has been furnished. Recipient must pay vendor within 180 days from invoice date, else ITC must be reversed with interest.`,
    legal_rule_metadata: {
      is_blocked_credit: false,
      keywords: ["itc", "eligibility", "tax invoice", "180 days", "reversal", "gstr-3b"],
    },
  },
  {
    section_title: "Apportionment of credit and blocked credits - Motor Vehicles",
    source_act: "CGST_ACT",
    section_number: "17(5)(a)",
    category: "BLOCKED_CREDIT",
    content: `Input tax credit shall NOT be available in respect of motor vehicles for transportation of persons having approved seating capacity of not more than 13 persons (including the driver). EXCEPTIONS where ITC is allowed: (a) When used for further supply of such motor vehicles; (b) Transportation of passengers; (c) Imparting training on driving such motor vehicles. Servicing, insurance, and repairs of such blocked vehicles are also blocked under 17(5)(ab).`,
    legal_rule_metadata: {
      is_blocked_credit: true,
      sub_clause: "17(5)(a)",
      exceptions: ["sale of vehicles", "passenger transport business", "driving school training"],
      keywords: ["motor vehicle", "car", "car repair", "car insurance", "automobile", "cab"],
    },
  },
  {
    section_title: "Blocked credits - Food, Beverages, Outdoor Catering, Health & Beauty",
    source_act: "CGST_ACT",
    section_number: "17(5)(b)(i)",
    category: "BLOCKED_CREDIT",
    content: `Input tax credit shall NOT be available in respect of food and beverages, outdoor catering, beauty treatment, health services, cosmetic and plastic surgery, life insurance and health insurance. EXCEPTION: ITC is available where the provision of such goods or services or both is obligatory for an employer to provide to its employees under any law for the time being in force, or where used as inward supply for making taxable outward supply of the same category.`,
    legal_rule_metadata: {
      is_blocked_credit: true,
      sub_clause: "17(5)(b)(i)",
      exceptions: ["statutory statutory law obligation for employees (e.g. Factories Act canteen)", "sub-contracting catering"],
      keywords: ["food", "beverage", "catering", "restaurant", "lunch", "dinner", "health insurance", "beauty", "cosmetic", "gym"],
    },
  },
  {
    section_title: "Blocked credits - Club Membership & Vacation Travel Benefits",
    source_act: "CGST_ACT",
    section_number: "17(5)(b)(ii)&(iii)",
    category: "BLOCKED_CREDIT",
    content: `Input tax credit shall NOT be available for membership of a club, health and fitness centre, and travel benefits extended to employees on vacation such as leave or home travel concession (LTC/LTA).`,
    legal_rule_metadata: {
      is_blocked_credit: true,
      sub_clause: "17(5)(b)(ii)",
      keywords: ["club", "fitness", "gym membership", "ltc", "vacation", "holiday travel"],
    },
  },
  {
    section_title: "Blocked credits - Works Contract & Immovable Property Construction",
    source_act: "CGST_ACT",
    section_number: "17(5)(c)&(d)",
    category: "BLOCKED_CREDIT",
    content: `Input tax credit is blocked for works contract services and goods or services received by a taxable person for construction of an immovable property (other than plant or machinery) on his own account, including when such goods or services or both are used in the course or furtherance of business. If capitalized to building, ITC is blocked; if routine repairs expensed to P&L, ITC is available.`,
    legal_rule_metadata: {
      is_blocked_credit: true,
      sub_clause: "17(5)(c)",
      exceptions: ["plant and machinery", "works contract for further supply of works contract", "routine repairs expensed to revenue"],
      keywords: ["construction", "building", "civil work", "works contract", "cement", "bricks", "interior decoration capitalized"],
    },
  },
  {
    section_title: "Blocked credits - Personal Consumption, Lost, Stolen or Free Samples",
    source_act: "CGST_ACT",
    section_number: "17(5)(g)&(h)",
    category: "BLOCKED_CREDIT",
    content: `Input tax credit shall NOT be available for goods or services or both used for personal consumption (17(5)(g)), and goods lost, stolen, destroyed, written off or disposed of by way of gift or free samples (17(5)(h)).`,
    legal_rule_metadata: {
      is_blocked_credit: true,
      sub_clause: "17(5)(g)&(h)",
      keywords: ["personal use", "gift", "sample", "stolen", "lost", "damaged", "write off"],
    },
  },
  {
    section_title: "Order of utilization of Input Tax Credit (Rule 88A & Section 49B)",
    source_act: "RULES",
    section_number: "88A",
    category: "SET_OFF_RULES",
    content: `Input tax credit on account of Integrated Tax (IGST) shall first be utilized towards payment of Integrated Tax, and the amount remaining, if any, may be utilized towards the payment of Central Tax (CGST) and State Tax (SGST) / Union territory Tax in any order and in any proportion. Provided that the input tax credit on account of Central Tax or State Tax / UT Tax shall be utilized towards payment of IGST, CGST or SGST only after the input tax credit on account of Integrated Tax has first been completely exhausted. CGST cannot be set off against SGST.`,
    legal_rule_metadata: {
      keywords: ["rule 88a", "set-off", "itc utilization", "igst set off", "cgst sgst offset", "tax payment order"],
    },
  },
  {
    section_title: "Restriction on utilization of input tax credit (Rule 86B - 1% Cash Ledger)",
    source_act: "RULES",
    section_number: "86B",
    category: "SET_OFF_RULES",
    content: `Rule 86B restricts the use of electronic credit ledger to discharge tax liability. Registered persons having taxable supply (other than exempt and zero-rated supplies) exceeding ₹50 Lakhs in a month cannot use ITC to discharge more than 99% of the output tax liability. Minimum 1% must be paid via electronic cash ledger. Exceptions apply to persons who paid > ₹1 Lakh income tax in preceding 2 years or received > ₹1 Lakh refund of unutilized ITC under inverted duty / exports.`,
    legal_rule_metadata: {
      mandatory_cash_percent: 1,
      keywords: ["rule 86b", "1% cash", "50 lakhs limit", "cash ledger", "credit ledger restriction"],
    },
  },
  {
    section_title: "Interest on delayed payment of tax (Section 50)",
    source_act: "CGST_ACT",
    section_number: "50",
    category: "INTEREST_PENALTY",
    content: `Every person liable to pay tax who fails to pay the tax to the Government within the prescribed period shall pay interest at the rate of 18% per annum. Interest is calculated on the net tax paid through the electronic cash ledger (not on gross liability offset by available ITC). In case of undue or excess claim of input tax credit or undue reduction in output tax liability, interest is payable at 24% per annum under Section 50(3).`,
    legal_rule_metadata: {
      interest_rate_percent: 18,
      keywords: ["section 50", "interest", "18 percent", "24 percent", "delayed payment", "late filing"],
    },
  },
  {
    section_title: "Reverse Charge Mechanism (RCM - Section 9(3) & 9(4))",
    source_act: "CGST_ACT",
    section_number: "9(3)",
    category: "RCM",
    content: `Under Reverse Charge Mechanism (RCM), the recipient of goods or services is liable to pay tax instead of the supplier. Key RCM categories: (1) Goods Transport Agency (GTA) services; (2) Legal services provided by an advocate or firm of advocates; (3) Sponsorship services; (4) Services supplied by a director of a company; (5) Renting of residential dwelling to a registered person. Tax under RCM MUST be paid in CASH (cannot use ITC to pay RCM liability), but recipient can claim ITC of the tax paid under RCM in the same month.`,
    legal_rule_metadata: {
      keywords: ["rcm", "reverse charge", "gta", "advocate fees", "director remuneration", "cash payment"],
    },
  },
];

export class KnowledgeService {
  private static instance: KnowledgeService;

  private constructor() {}

  public static getInstance(): KnowledgeService {
    if (!KnowledgeService.instance) {
      KnowledgeService.instance = new KnowledgeService();
    }
    return KnowledgeService.instance;
  }

  /**
   * Search knowledge base by semantic match or keyword scoring
   */
  public async search(userQuery: string, limit: number = 3): Promise<GSTKnowledgeItem[]> {
    const cleanQuery = userQuery.toLowerCase();
    const queryWords = cleanQuery.split(/\s+/).filter((w) => w.length > 2);

    // Try database pgvector search if available
    try {
      const dbRes = await query(
        `SELECT section_title, source_act, section_number, category, content, legal_rule_metadata
         FROM gst_knowledge_base
         WHERE content ILIKE $1 OR section_title ILIKE $1
         LIMIT $2`,
        [`%${cleanQuery}%`, limit]
      );

      if (dbRes.rows.length > 0) {
        return dbRes.rows as GSTKnowledgeItem[];
      }
    } catch {
      // Fall back to statutory in-memory graph
    }

    // In-memory weighted scoring
    const scored = STATUTORY_TAX_KNOWLEDGE.map((item) => {
      let score = 0;
      const contentLower = item.content.toLowerCase();
      const titleLower = item.section_title.toLowerCase();
      const keywords = item.legal_rule_metadata.keywords || [];

      // Keyword exact matching
      for (const kw of keywords) {
        if (cleanQuery.includes(kw.toLowerCase())) {
          score += 10;
        }
      }

      // Title match
      for (const word of queryWords) {
        if (titleLower.includes(word)) score += 5;
        if (contentLower.includes(word)) score += 2;
      }

      // Section number direct match (e.g. "17(5)")
      if (cleanQuery.includes(item.section_number.toLowerCase())) {
        score += 20;
      }

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.item);
  }

  /**
   * Specifically check if an expense or item description is blocked under Section 17(5)
   */
  public checkBlockedCredit(itemDescription: string): {
    isBlocked: boolean;
    section?: string;
    reason?: string;
    statutoryRef?: string;
  } {
    const desc = itemDescription.toLowerCase();

    // Motor vehicles & maintenance
    if (
      desc.includes("car") ||
      desc.includes("motor vehicle") ||
      desc.includes("petrol") ||
      desc.includes("diesel") ||
      desc.includes("cab") ||
      desc.includes("vehicle insurance") ||
      desc.includes("car repair") ||
      desc.includes("vehicle service")
    ) {
      return {
        isBlocked: true,
        section: "Section 17(5)(a)",
        reason: "Motor vehicles for passenger transport (<=13 seating capacity) and related insurance/repairs are blocked from ITC unless used in passenger transport, driving school, or vehicle resale business.",
        statutoryRef: "CGST Act 2017 Sec 17(5)(a) & 17(5)(ab)",
      };
    }

    // Food, catering, restaurant, beverages
    if (
      desc.includes("food") ||
      desc.includes("catering") ||
      desc.includes("restaurant") ||
      desc.includes("beverage") ||
      desc.includes("lunch") ||
      desc.includes("dinner") ||
      desc.includes("snacks") ||
      desc.includes("coffee") ||
      desc.includes("sweets")
    ) {
      return {
        isBlocked: true,
        section: "Section 17(5)(b)(i)",
        reason: "Food, beverages, and outdoor catering are specifically blocked from ITC under Section 17(5)(b)(i) unless obligatory under statutory employment law or used for outward catering supply.",
        statutoryRef: "CGST Act 2017 Sec 17(5)(b)(i)",
      };
    }

    // Club membership & gym
    if (desc.includes("club") || desc.includes("gym") || desc.includes("fitness") || desc.includes("spa")) {
      return {
        isBlocked: true,
        section: "Section 17(5)(b)(ii)",
        reason: "Membership of clubs, health, and fitness centers is blocked from ITC.",
        statutoryRef: "CGST Act 2017 Sec 17(5)(b)(ii)",
      };
    }

    // Personal use, gifts, free samples
    if (desc.includes("gift") || desc.includes("sample") || desc.includes("personal") || desc.includes("diwali gift")) {
      return {
        isBlocked: true,
        section: "Section 17(5)(h)",
        reason: "Goods given as gifts, free samples, or used for personal consumption are blocked from ITC.",
        statutoryRef: "CGST Act 2017 Sec 17(5)(g)&(h)",
      };
    }

    return {
      isBlocked: false,
      reason: "Eligible for Input Tax Credit in the course or furtherance of business under Section 16(1).",
      statutoryRef: "CGST Act 2017 Sec 16(1)",
    };
  }
}

export const knowledgeService = KnowledgeService.getInstance();
