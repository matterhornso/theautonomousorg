export interface SuggestedPlatform {
  serviceName: string;
  displayName: string;
  description: string;
  category: string;
  relevantAgents: string[];
  docsUrl: string;
  keyInstructions: string;
}

export const suggestedPlatforms: SuggestedPlatform[] = [
  // Sales
  { serviceName: "apollo", displayName: "Apollo.io", description: "Prospect search, contact enrichment, lead lists", category: "Sales", relevantAgents: ["Sales", "Strategy"], docsUrl: "https://docs.apollo.io", keyInstructions: "Go to Settings \u2192 Integrations \u2192 API Keys \u2192 Create new key" },
  { serviceName: "instantly", displayName: "Instantly.ai", description: "Email outreach campaigns, deliverability, analytics", category: "Sales & Marketing", relevantAgents: ["Sales", "Marketing"], docsUrl: "https://developer.instantly.ai", keyInstructions: "Go to Settings \u2192 API \u2192 Generate API Key" },
  { serviceName: "hubspot", displayName: "HubSpot", description: "CRM, deal tracking, contact management, pipelines", category: "Sales", relevantAgents: ["Sales", "Marketing", "Customer Success"], docsUrl: "https://developers.hubspot.com", keyInstructions: "Settings \u2192 Integrations \u2192 Private Apps \u2192 Create \u2192 Copy access token" },
  { serviceName: "salesforce", displayName: "Salesforce", description: "Enterprise CRM, opportunity tracking, forecasting", category: "Sales", relevantAgents: ["Sales", "Strategy"], docsUrl: "https://developer.salesforce.com", keyInstructions: "Setup \u2192 Apps \u2192 Connected Apps \u2192 Create \u2192 Copy consumer key + secret" },

  // Marketing
  { serviceName: "buffer", displayName: "Buffer", description: "Social media scheduling, publishing, analytics", category: "Marketing", relevantAgents: ["Marketing"], docsUrl: "https://buffer.com/developers/api", keyInstructions: "Go to buffer.com/developers \u2192 Create App \u2192 Copy access token" },
  { serviceName: "mailchimp", displayName: "Mailchimp", description: "Email marketing, newsletters, audience management", category: "Marketing", relevantAgents: ["Marketing"], docsUrl: "https://mailchimp.com/developer", keyInstructions: "Account \u2192 Extras \u2192 API Keys \u2192 Create a key" },
  { serviceName: "semrush", displayName: "SEMrush", description: "SEO analysis, keyword research, competitor tracking", category: "Marketing", relevantAgents: ["Marketing", "Strategy"], docsUrl: "https://developer.semrush.com", keyInstructions: "SEMrush dashboard \u2192 My Profile \u2192 API Key" },
  { serviceName: "canva", displayName: "Canva", description: "Design templates, social media graphics, brand kit", category: "Marketing", relevantAgents: ["Marketing"], docsUrl: "https://www.canva.dev", keyInstructions: "Canva Developers \u2192 Create App \u2192 Copy API key" },

  // Accounting & Finance
  { serviceName: "quickbooks", displayName: "QuickBooks", description: "Bookkeeping, invoicing, expense tracking, tax prep", category: "Accounting", relevantAgents: ["Accounting", "Finance"], docsUrl: "https://developer.intuit.com", keyInstructions: "developer.intuit.com \u2192 Create App \u2192 Copy Client ID + Secret" },
  { serviceName: "xero", displayName: "Xero", description: "Cloud accounting, bank reconciliation, payroll", category: "Accounting", relevantAgents: ["Accounting", "Finance"], docsUrl: "https://developer.xero.com", keyInstructions: "developer.xero.com \u2192 My Apps \u2192 New App \u2192 Copy credentials" },
  { serviceName: "stripe", displayName: "Stripe", description: "Payment processing, subscriptions, revenue data", category: "Finance", relevantAgents: ["Finance", "Accounting"], docsUrl: "https://stripe.com/docs/api", keyInstructions: "Stripe Dashboard \u2192 Developers \u2192 API Keys \u2192 Copy secret key" },
  { serviceName: "brex", displayName: "Brex", description: "Corporate cards, expense management, bill pay", category: "Finance", relevantAgents: ["Finance", "Accounting"], docsUrl: "https://developer.brex.com", keyInstructions: "Brex Dashboard \u2192 Developer \u2192 Create API Token" },

  // Communication
  { serviceName: "slack", displayName: "Slack", description: "Team messaging, channel notifications, workflow updates", category: "Communication", relevantAgents: ["Admin", "CEO", "HR"], docsUrl: "https://api.slack.com", keyInstructions: "api.slack.com \u2192 Create App \u2192 OAuth & Permissions \u2192 Install \u2192 Copy Bot Token" },
  { serviceName: "gmail", displayName: "Gmail / Google Workspace", description: "Email sending, calendar, docs, sheets", category: "Communication", relevantAgents: ["Sales", "Marketing", "Admin", "HR"], docsUrl: "https://developers.google.com/workspace", keyInstructions: "console.cloud.google.com \u2192 Create Project \u2192 Enable APIs \u2192 Create OAuth credentials" },
  { serviceName: "twilio", displayName: "Twilio", description: "SMS, WhatsApp messaging, voice calls", category: "Communication", relevantAgents: ["Sales", "Customer Success"], docsUrl: "https://www.twilio.com/docs", keyInstructions: "Twilio Console \u2192 Account \u2192 API Keys \u2192 Create key" },

  // Development
  { serviceName: "github", displayName: "GitHub", description: "Code repositories, PR management, CI/CD", category: "Development", relevantAgents: ["Front-End Engineering", "Back-End Engineering"], docsUrl: "https://docs.github.com/en/rest", keyInstructions: "GitHub \u2192 Settings \u2192 Developer Settings \u2192 Personal Access Tokens \u2192 Generate" },
  { serviceName: "linear", displayName: "Linear", description: "Issue tracking, sprint planning, roadmap", category: "Development", relevantAgents: ["Product", "Front-End Engineering", "Back-End Engineering"], docsUrl: "https://developers.linear.app", keyInstructions: "Linear \u2192 Settings \u2192 API \u2192 Personal API Keys \u2192 Create" },
  { serviceName: "vercel", displayName: "Vercel", description: "Deployment, hosting, serverless functions", category: "Development", relevantAgents: ["Front-End Engineering", "Back-End Engineering"], docsUrl: "https://vercel.com/docs/rest-api", keyInstructions: "Vercel \u2192 Settings \u2192 Tokens \u2192 Create" },

  // Customer Success
  { serviceName: "intercom", displayName: "Intercom", description: "Live chat, help desk, knowledge base, customer data", category: "Customer Success", relevantAgents: ["Customer Success", "Sales"], docsUrl: "https://developers.intercom.com", keyInstructions: "Intercom \u2192 Settings \u2192 Developers \u2192 Create App \u2192 Copy access token" },
  { serviceName: "zendesk", displayName: "Zendesk", description: "Support tickets, help center, customer satisfaction", category: "Customer Success", relevantAgents: ["Customer Success"], docsUrl: "https://developer.zendesk.com", keyInstructions: "Zendesk Admin \u2192 Apps \u2192 API \u2192 Create Token" },

  // HR
  { serviceName: "greenhouse", displayName: "Greenhouse", description: "Applicant tracking, recruiting pipeline, interview scheduling", category: "HR", relevantAgents: ["HR"], docsUrl: "https://developers.greenhouse.io", keyInstructions: "Greenhouse \u2192 Configure \u2192 Dev Center \u2192 API Credential Management \u2192 Create" },
  { serviceName: "bamboohr", displayName: "BambooHR", description: "HR management, employee records, performance reviews", category: "HR", relevantAgents: ["HR"], docsUrl: "https://documentation.bamboohr.com/docs", keyInstructions: "BambooHR \u2192 Account \u2192 API Keys \u2192 Add New Key" },

  // Data & Analytics
  { serviceName: "mixpanel", displayName: "Mixpanel", description: "Product analytics, user behavior, funnel analysis", category: "Analytics", relevantAgents: ["Data Analyst", "Product"], docsUrl: "https://developer.mixpanel.com", keyInstructions: "Mixpanel \u2192 Settings \u2192 Project Settings \u2192 Copy API Secret" },
  { serviceName: "google_analytics", displayName: "Google Analytics", description: "Website analytics, traffic sources, conversion tracking", category: "Analytics", relevantAgents: ["Data Analyst", "Marketing"], docsUrl: "https://developers.google.com/analytics", keyInstructions: "Google Cloud Console \u2192 Create OAuth credentials for Analytics API" },

  // Legal
  { serviceName: "docusign", displayName: "DocuSign", description: "E-signatures, contract management, document workflows", category: "Legal", relevantAgents: ["Legal", "Admin", "Sales"], docsUrl: "https://developers.docusign.com", keyInstructions: "DocuSign \u2192 Settings \u2192 Apps and Keys \u2192 Add App \u2192 Copy Integration Key" },

  // Custom
  { serviceName: "custom", displayName: "Custom API", description: "Connect any API with a key \u2014 your agent will learn to use it", category: "Custom", relevantAgents: ["All"], docsUrl: "", keyInstructions: "Paste your API key and describe what the API does" },
];
