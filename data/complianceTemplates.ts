// Pre-built compliance rule templates for common regulations
// Users can select these as starting points and customize them

export interface ComplianceTemplate {
  id: string;
  name: string;
  description: string;
  category: 'pharmaceutical' | 'healthcare' | 'advertising' | 'privacy' | 'financial' | 'general';
  ruleText: string;
  source: string; // e.g., "FDA", "FTC", "GDPR"
  lastUpdated?: string;
}

export const COMPLIANCE_TEMPLATES: ComplianceTemplate[] = [
  {
    id: 'fda-pharma-marketing',
    name: 'FDA Pharmaceutical Marketing',
    description: 'FDA regulations for prescription drug marketing and advertising',
    category: 'pharmaceutical',
    source: 'FDA',
    ruleText: `FDA COMPLIANCE RULES FOR PRESCRIPTION DRUG MARKETING

1. FAIR BALANCE REQUIREMENT
   - All claims about a drug's benefits must be balanced with risk information
   - Risk information must be presented with comparable prominence to benefit claims
   - Cannot minimize or omit important risk information

2. SUBSTANTIATION OF CLAIMS
   - All efficacy claims must be supported by substantial evidence from adequate and well-controlled studies
   - Cannot make unsubstantiated superiority claims
   - Comparative claims must be supported by head-to-head clinical trials

3. OFF-LABEL PROMOTION PROHIBITION
   - Cannot promote drugs for uses not approved by FDA
   - Cannot suggest uses beyond the approved indication
   - Educational materials must clearly distinguish approved uses from off-label information

4. REQUIRED DISCLOSURES
   - Must include brief summary of prescribing information for print ads
   - Must include major statement of risks in broadcast ads
   - Must provide adequate directions for use
   - Must include name of drug and established name (generic name)

5. PROHIBITED CLAIMS
   - Cannot claim a drug is "safe" without qualification
   - Cannot use misleading statistics or data presentations
   - Cannot make false or misleading representations about clinical studies
   - Cannot omit material facts about the drug

6. DIRECT-TO-CONSUMER (DTC) SPECIFIC RULES
   - Must encourage patients to discuss with healthcare providers
   - Must include statement: "Ask your doctor if [drug name] is right for you"
   - Must provide toll-free number or website for additional information
   - Cannot suggest the drug is a substitute for medical consultation

7. SOCIAL MEDIA GUIDELINES
   - Character-limited platforms must include direct link to complete risk information
   - Cannot use misleading hashtags or claims
   - User-generated content must be monitored for compliance violations
   - Must correct misinformation promptly

8. DISCLOSURE OF RELATIONSHIPS
   - Must disclose if content is sponsored or paid
   - Healthcare professionals must disclose financial relationships if applicable
   - Influencer partnerships must be clearly disclosed

9. RISK COMMUNICATION
   - Most serious risks must be prominently displayed
   - Cannot use distracting visuals or music that minimize risk information
   - Risk information must be readable and understandable
   - Must update risk information as new safety data becomes available

10. COMPARATIVE CLAIMS
    - Comparative efficacy claims must be supported by adequate studies
    - Cannot disparage competitor products with unsubstantiated claims
    - Must fairly represent competitor products when making comparisons`,
    lastUpdated: '2024-01-15'
  },
  {
    id: 'ftc-advertising',
    name: 'FTC Advertising Standards',
    description: 'Federal Trade Commission guidelines for truthful and non-deceptive advertising',
    category: 'advertising',
    source: 'FTC',
    ruleText: `FTC ADVERTISING COMPLIANCE RULES

1. TRUTHFULNESS AND SUBSTANTIATION
   - All objective claims must be supported by competent and reliable evidence
   - Claims must be truthful and not misleading
   - Must have evidence before making claims (not after challenged)

2. DECEPTIVE PRACTICES PROHIBITED
   - Cannot make false or misleading claims about products or services
   - Cannot omit material information that would affect consumer decisions
   - Cannot use deceptive pricing, testimonials, or endorsements

3. ENDORSEMENTS AND TESTIMONIALS
   - Endorsements must reflect honest opinions and experiences
   - Must disclose material connections between endorsers and advertisers
   - Cannot use fake reviews or testimonials
   - Celebrity endorsements must be genuine

4. HEALTH AND SAFETY CLAIMS
   - Health benefit claims require competent and reliable scientific evidence
   - Cannot make unsubstantiated health claims
   - Weight loss and disease treatment claims have higher substantiation requirements
   - Must clearly disclose limitations and risks

5. PRICING AND DISCOUNTS
   - Cannot use false "original" prices to make discounts appear larger
   - "Free" offers must truly be free (no hidden costs)
   - Must clearly disclose all costs and fees
   - Cannot use misleading "limited time" or scarcity tactics

6. DISCLOSURES
   - Material disclosures must be clear and conspicuous
   - Cannot hide important information in fine print
   - Disclosures must be in close proximity to the claim
   - Must be understandable to the target audience

7. TARGETING VULNERABLE AUDIENCES
   - Special care required when targeting children, elderly, or other vulnerable groups
   - Cannot exploit lack of knowledge or experience
   - Must use clear, simple language for vulnerable audiences

8. ENVIRONMENTAL CLAIMS
   - "Green" or environmental claims must be substantiated
   - Cannot use vague terms like "eco-friendly" without qualification
   - Must specify what makes a product environmentally beneficial

9. DATA AND PRIVACY
   - Must comply with privacy policies and disclosures
   - Cannot use consumer data in ways not disclosed
   - Must provide opt-out mechanisms where required

10. SOCIAL MEDIA AND INFLUENCERS
    - Influencer posts must clearly disclose material connections
    - Must use clear disclosure language (#ad, #sponsored)
    - Cannot use fake followers or engagement
    - Must monitor influencer content for compliance`,
    lastUpdated: '2024-01-15'
  },
  {
    id: 'gdpr-marketing',
    name: 'GDPR Marketing Compliance',
    description: 'General Data Protection Regulation requirements for marketing communications',
    category: 'privacy',
    source: 'GDPR',
    ruleText: `GDPR COMPLIANCE RULES FOR MARKETING

1. CONSENT REQUIREMENTS
   - Must obtain explicit, informed consent before sending marketing communications
   - Consent must be freely given, specific, and unambiguous
   - Must provide clear opt-in mechanism (not pre-checked boxes)
   - Must allow easy withdrawal of consent

2. DATA MINIMIZATION
   - Only collect personal data necessary for marketing purposes
   - Cannot collect excessive or irrelevant data
   - Must justify why each piece of data is needed

3. TRANSPARENCY
   - Must clearly inform individuals about data collection and use
   - Privacy notices must be clear, concise, and accessible
   - Must explain purpose of data processing
   - Must inform about data retention periods

4. RIGHT TO ACCESS
   - Individuals have right to access their personal data
   - Must provide data in commonly used format
   - Must respond within one month

5. RIGHT TO ERASURE (RIGHT TO BE FORGOTTEN)
   - Must honor requests to delete personal data
   - Must delete data when no longer necessary for original purpose
   - Must inform third parties if data has been shared

6. DATA PORTABILITY
   - Must provide data in structured, machine-readable format
   - Must allow transfer to another service provider

7. PROFILING RESTRICTIONS
   - Must inform individuals about automated decision-making
   - Must allow opt-out of profiling for marketing
   - Cannot make solely automated decisions with legal effect without consent

8. CROSS-BORDER TRANSFERS
   - Cannot transfer personal data outside EU without adequate safeguards
   - Must use approved transfer mechanisms (Standard Contractual Clauses, etc.)
   - Must inform individuals about transfers

9. DATA BREACH NOTIFICATION
   - Must notify supervisory authority within 72 hours of breach
   - Must notify affected individuals without undue delay if high risk
   - Must document all breaches

10. MARKETING COMMUNICATIONS
    - Email marketing requires opt-in consent (soft opt-in allowed for existing customers)
    - Must provide clear unsubscribe mechanism in every communication
    - Must honor opt-out requests immediately
    - Cannot send marketing to individuals who have opted out
    - Must identify sender clearly in all communications

11. COOKIES AND TRACKING
    - Must obtain consent before placing non-essential cookies
    - Must provide clear information about cookie purposes
    - Must allow users to reject non-essential cookies
    - Cannot make access conditional on cookie consent

12. CHILDREN'S DATA
    - Special protections for children under 16 (or 13-16 depending on member state)
    - Must obtain parental consent for children's data processing
    - Must use clear, child-friendly language in privacy notices`,
    lastUpdated: '2024-01-15'
  },
  {
    id: 'hipaa-marketing',
    name: 'HIPAA Marketing Rules',
    description: 'Health Insurance Portability and Accountability Act requirements for healthcare marketing',
    category: 'healthcare',
    source: 'HIPAA',
    ruleText: `HIPAA COMPLIANCE RULES FOR MARKETING

1. AUTHORIZATION REQUIREMENT
   - Written authorization required before using PHI for marketing
   - Authorization must be specific and clearly identify marketing purpose
   - Cannot condition treatment on providing marketing authorization
   - Authorization must be separate from other consents

2. DEFINITION OF MARKETING
   - Marketing = communication about product/service that encourages purchase
   - Face-to-face communications and promotional gifts of nominal value are exceptions
   - Treatment communications are NOT marketing (e.g., appointment reminders)

3. PROHIBITED USES
   - Cannot use PHI for marketing without authorization
   - Cannot sell PHI for marketing purposes
   - Cannot use PHI to send marketing materials without authorization
   - Cannot share PHI with third parties for their marketing without authorization

4. EXCEPTIONS (No Authorization Required)
   - Face-to-face communications
   - Promotional gifts of nominal value
   - Communications about health-related products/services you provide
   - Communications about treatment alternatives
   - Communications about health-related benefits and services

5. THIRD-PARTY MARKETING
   - Must obtain authorization before disclosing PHI to third parties for their marketing
   - Must clearly identify third party in authorization
   - Must explain that payment may be received for disclosure

6. FUNDRAISING
   - Can use limited PHI for fundraising without authorization
   - Must provide opt-out mechanism in every fundraising communication
   - Must honor opt-out requests

7. MINIMUM NECESSARY
   - Only use minimum necessary PHI for marketing purposes
   - Cannot access or use more PHI than needed

8. BUSINESS ASSOCIATE AGREEMENTS
   - Must have BAA with vendors who handle PHI for marketing
   - Must ensure vendors comply with HIPAA requirements
   - Must monitor vendor compliance

9. PATIENT RIGHTS
   - Patients have right to restrict certain disclosures
   - Must honor patient requests to restrict marketing communications
   - Must provide access to marketing authorizations upon request

10. DOCUMENTATION
    - Must document all marketing authorizations
    - Must maintain records of marketing communications
    - Must be able to demonstrate compliance upon audit`,
    lastUpdated: '2024-01-15'
  },
  {
    id: 'sec-financial-marketing',
    name: 'SEC Financial Marketing',
    description: 'Securities and Exchange Commission rules for financial services marketing',
    category: 'financial',
    source: 'SEC',
    ruleText: `SEC COMPLIANCE RULES FOR FINANCIAL MARKETING

1. ANTI-FRAUD PROVISIONS
   - Cannot make false or misleading statements
   - Cannot omit material facts
   - Cannot engage in fraudulent, deceptive, or manipulative practices
   - All claims must be truthful and substantiated

2. TESTIMONIALS AND ENDORSEMENTS
   - Must disclose if testimonials are paid or compensated
   - Cannot use misleading testimonials
   - Must disclose any conflicts of interest
   - Past performance must include required disclaimers

3. PERFORMANCE CLAIMS
   - Cannot guarantee investment returns
   - Past performance does not guarantee future results (must be stated)
   - Must include required risk disclosures
   - Performance data must be accurate and not misleading

4. DISCLOSURE REQUIREMENTS
   - Must provide required disclosures in marketing materials
   - Disclosures must be clear and conspicuous
   - Cannot hide important information
   - Must update disclosures as circumstances change

5. SUITABILITY
   - Marketing must be appropriate for target audience
   - Must consider investor sophistication
   - Cannot target unsuitable investors
   - Must provide adequate risk warnings

6. REGISTRATION AND LICENSING
   - Must be properly registered/licensed before marketing
   - Cannot market unregistered securities
   - Must comply with state and federal registration requirements

7. SOCIAL MEDIA
   - Must comply with recordkeeping requirements
   - Must supervise social media communications
   - Must archive all social media marketing
   - Must comply with advertising rules on all platforms

8. RISK DISCLOSURES
   - Must clearly disclose investment risks
   - Risk disclosures must be prominent
   - Cannot minimize risks
   - Must use clear, understandable language

9. COMPARATIVE CLAIMS
   - Comparative claims must be fair and accurate
   - Must compare like-to-like
   - Cannot use misleading comparisons
   - Must substantiate all comparative claims

10. PROHIBITED PRACTICES
    - Cannot use misleading charts or graphs
    - Cannot cherry-pick favorable data
    - Cannot use misleading statistics
    - Must present balanced view of risks and benefits`,
    lastUpdated: '2024-01-15'
  },
  {
    id: 'general-brand-safety',
    name: 'General Brand Safety',
    description: 'General brand safety and reputation protection guidelines',
    category: 'general',
    source: 'Industry Best Practices',
    ruleText: `GENERAL BRAND SAFETY GUIDELINES

1. TONE AND VOICE CONSISTENCY
   - Maintain consistent brand voice across all channels
   - Align messaging with brand values and positioning
   - Avoid language that conflicts with brand identity
   - Ensure tone is appropriate for target audience

2. ACCURACY AND TRUTHFULNESS
   - All claims must be accurate and verifiable
   - Fact-check all statistics and data points
   - Correct errors promptly and transparently
   - Avoid exaggeration or hyperbole

3. SENSITIVITY AND INCLUSIVITY
   - Use inclusive language and imagery
   - Avoid stereotypes or offensive content
   - Be sensitive to cultural, religious, and social contexts
   - Consider diverse perspectives and experiences

4. COMPETITIVE POSITIONING
   - Focus on own strengths, not competitor weaknesses
   - Avoid disparaging competitors
   - Make fair and substantiated comparisons if needed
   - Respect competitive boundaries

5. CRISIS COMMUNICATION
   - Have crisis communication plan in place
   - Respond quickly and transparently to issues
   - Take responsibility for mistakes
   - Provide clear, accurate information during crises

6. SOCIAL RESPONSIBILITY
   - Align with socially responsible practices
   - Avoid supporting harmful practices or industries
   - Consider environmental impact
   - Support positive social causes authentically

7. INTELLECTUAL PROPERTY
   - Respect copyrights and trademarks
   - Obtain proper licenses for third-party content
   - Protect own intellectual property
   - Avoid infringement of others' rights

8. TRANSPARENCY
   - Clearly identify sponsored or paid content
   - Disclose partnerships and relationships
   - Be transparent about data collection and use
   - Provide clear terms and conditions

9. CUSTOMER PRIVACY
   - Respect customer privacy
   - Comply with privacy laws and regulations
   - Protect customer data
   - Provide clear privacy policies

10. CONTENT MODERATION
    - Monitor user-generated content
    - Remove inappropriate or harmful content
    - Respond to negative feedback professionally
    - Maintain community guidelines`,
    lastUpdated: '2024-01-15'
  }
];

export function getTemplatesByCategory(category?: ComplianceTemplate['category']): ComplianceTemplate[] {
  if (!category) return COMPLIANCE_TEMPLATES;
  return COMPLIANCE_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateById(id: string): ComplianceTemplate | undefined {
  return COMPLIANCE_TEMPLATES.find(t => t.id === id);
}

