// Canned example estimate streamed in demo mode (no DEEPSEEK_API_KEY configured).
// It mirrors exactly what the live DeepSeek agent produces, so the UI + PDF pipeline can be tested end-to-end.

export const DEMO_RESPONSE = `# CALIBIAI COMMERCIAL ESTIMATE

## 1. Requirement Summary
- Website + WhatsApp AI assistant that answers product questions from the client's PDFs.
- Captures visitor details and qualifies leads during the conversation.
- Qualified leads are pushed automatically into Zoho CRM with conversation notes.
- Expected volume: ~2,000 conversations/month (assumed; flagged in Assumptions).
- Client assumed to be a Pune-based business using Zoho CRM already.

## 2. Recommended Solution
Build an **AI Lead Qualification & Customer Engagement System** — one AI assistant deployed on both the website chat widget and WhatsApp that answers product questions from the client's PDF knowledge base, captures contact details, scores and qualifies each lead through a short conversation flow, and syncs qualified leads into Zoho CRM with a summary and lead score. A simple admin dashboard lets the sales team review conversations and export leads. Delivered in English, production-ready, with handover documentation.

## 3. Complexity
Medium — multi-channel deployment, RAG pipeline, lead-qualification flow and CRM integration, but no custom model training, voice or enterprise security requirements.

## 4. Estimated Effort
| Workstream | Hours | Team |
|---|---|---|
| Solution architecture & PM | 10 | Solution Architect / PM |
| AI/LLM & RAG engineering | 45 | AI/ML Specialist |
| Backend & APIs | 30 | Mid-Level Engineer |
| Frontend chat widget | 12 | Junior Engineer |
| WhatsApp + Zoho CRM integration | 25 | Mid-Level Engineer |
| QA, testing & UAT support | 13 | Mid-Level Engineer |
| **Total** | **135** | — |

**Total engineering effort: ~135 hours**

## 5. Market Benchmark
Estimated market benchmark based on typical Indian software/AI services pricing.

| Benchmark | Estimated Range |
|---|---|
| India | ₹2,00,000 – ₹4,50,000 |
| Pune | ₹1,60,000 – ₹3,50,000 |
| CalibiAI Recommended | ₹2,85,000 |

## 6. CalibiAI Packages
| Option | Price | Positioning |
|---|---|---|
| Basic | ₹1,90,000 | Minimum scope: website chatbot + RAG + lead capture, no WhatsApp |
| Recommended | ₹2,85,000 | Best value: website + WhatsApp, qualification flow, Zoho CRM push |
| Premium | ₹3,95,000 | Advanced: + voice AI, analytics dashboard, 2 languages, human handoff |

**CalibiAI recommendation: the Recommended package — it covers the client's complete stated requirement (both channels + CRM) at a price that beats typical agency quotes while protecting margin.**

## 7. Internal Economics
| Metric | Amount |
|---|---|
| Estimated Delivery Cost | ₹1,56,000 |
| Recommended Selling Price | ₹2,85,000 |
| Estimated Gross Profit | ₹1,29,000 |
| Estimated Gross Margin | 45% |
| Negotiation Price | ₹2,60,000 |
| Absolute Floor | ₹2,30,000 |

**INTERNAL ONLY — never share these numbers with the client.**

## 8. Included Scope
- Website chat widget + WhatsApp Business deployment (one number)
- RAG knowledge base from client PDFs (up to 50 documents, 2 refresh cycles)
- AI product Q&A + lead capture and qualification flow
- Zoho CRM integration: lead creation with conversation summary and score
- Basic admin dashboard: conversation log and lead export
- Content/language review (up to 2 review cycles)
- Testing, UAT support, deployment and handover documentation

## 9. Exclusions
- WhatsApp Business API / BSP conversation charges (billed at actuals)
- LLM API usage costs (billed at actuals)
- Cloud hosting and database costs
- Zoho CRM subscription (client-owned)
- Content writing beyond the documents provided
- Additional languages, voice channel, major UI redesign and ongoing content management

## 10. Third-Party Costs
- WhatsApp Business API + BSP: ₹1,000–₹2,500/month
- LLM API usage: ₹1,500–₹4,000/month at ~2,000 conversations
- Cloud hosting + database: ₹1,500–₹3,000/month
- CalibiAI Development Fee excludes all third-party usage charges listed above.

## 11. Timeline
4–5 weeks: discovery & design (3 days), AI + RAG build (2 weeks), website + WhatsApp deployment (1 week), CRM integration & QA (1 week), UAT + go-live (3–4 days).
Timeline assumes timely client access, approvals and required third-party credentials.

## 12. Payment Terms
- 40% advance — ₹1,14,000
- 30% on core build milestone — ₹85,500
- 20% on UAT sign-off — ₹57,000
- 10% on production go-live — ₹28,500

## 13. AMC / Recurring Revenue
**CALIBIAI AI CARE & OPTIMIZATION** — Growth plan at ₹60,000/month: system monitoring, bug fixes, prompt optimization, monthly knowledge-base refresh, AI/API cost optimization, monthly reporting, priority support and up to 8 hours of minor enhancements per month. (Essential plan at ₹35,000/month if the client prefers a lighter package.)

## 14. Optional Add-ons
- Voice AI channel: ₹75,000–₹1,20,000
- Advanced analytics dashboard: ₹45,000–₹75,000
- Human handoff to support desk: ₹35,000–₹60,000
- Multilingual support: ₹30,000 per language
- WhatsApp campaign / outbound module: ₹50,000
- Paid AI POC before full build (optional): ₹75,000, adjustable against the production fee

## 15. Sales Positioning
Sell this as an **AI Lead Qualification & Customer Engagement System**, not a chatbot: it answers customers instantly 24×7 on the channels they already use, captures every lead instead of losing visitors, and hands the sales team clean, scored leads in Zoho CRM — a direct revenue engine, not a cost item. Lead with the outcome: faster response means higher conversion, and zero manual data entry for the sales team.

## 16. Client-Facing Price
Quote ₹2,85,000 (one-time development) + third-party usage costs billed at actuals.

## 17. Negotiation Guidance
| Parameter | Value |
|---|---|
| Opening Quote | ₹2,85,000 |
| Target Closing Price | ₹2,60,000 |
| Maximum Normal Discount | 5% (~₹2,70,750) — BDO authority |
| Absolute Floor | ₹2,30,000 — founder approval below this |

Scope reductions if the client has a lower budget: drop WhatsApp (website-only Basic at ₹1,90,000); remove Zoho CRM push and use CSV/email lead delivery; reduce the knowledge base to 20 documents; or offer a ₹75,000 paid POC first with the fee adjustable against production. Discounts above 5% need sales/founder approval and should come with a scope reduction.

## 18. Client-Facing Summary
We propose an **AI Lead Qualification & Customer Engagement System** for your business. One AI assistant works across your website and WhatsApp, answers customer questions instantly from your own product documents, and hands your sales team clean, qualified leads inside Zoho CRM. The result is faster responses, zero missed enquiries and no manual data entry.

### What You Get
- **AI Assistant (Website + WhatsApp):** instant, accurate answers for every customer, 24×7.
- **Knowledge Base from Your Documents:** up to 50 PDFs, with two refresh cycles included.
- **Automatic Lead Qualification:** every visitor is captured, scored and summarised.
- **Zoho CRM Integration:** qualified leads created automatically with conversation notes.
- **Admin Dashboard:** conversation history, lead review and one-click export.
- **Go-Live Support:** testing, UAT assistance, deployment and handover documentation.

### Commercial Summary
| Item | Details |
|---|---|
| Solution | AI Lead Qualification & Customer Engagement System |
| Investment | ₹2,85,000 (one-time development fee) |
| Delivery Timeline | 4–5 weeks from kick-off |
| Payment Schedule | 40% advance ₹1,14,000 · 30% core build ₹85,500 · 20% UAT sign-off ₹57,000 · 10% go-live ₹28,500 |
| Support & Maintenance | CalibiAI AI Care & Optimization — ₹60,000/month (optional) |
| Third-Party Costs | ₹4,000–₹9,500/month (WhatsApp, AI usage, hosting) — billed at actuals |
| Quotation Validity | 30 days from the date of this proposal |

### Next Steps
1. Confirm the recommended package and share your product documents.
2. Provide WhatsApp Business and Zoho CRM access for integration.
3. Kick-off call within 3 working days of confirmation.

We would be glad to walk you through the solution in a short call whenever convenient.
`;
