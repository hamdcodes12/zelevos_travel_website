import type {
  CrmAdapter,
  DialerAdapter,
  WebhookAdapter,
  IntegrationProviderName,
  IntegrationProviderType,
} from "./types.js";
import { SalesforceCrmAdapter } from "./adapters/crm/salesforceAdapter.js";
import { HubSpotCrmAdapter } from "./adapters/crm/hubspotAdapter.js";
import { ZohoCrmAdapter } from "./adapters/crm/zohoAdapter.js";
import { GenericRestCrmAdapter } from "./adapters/crm/genericCrmAdapter.js";
import { VicidialDialerAdapter } from "./adapters/dialer/vicidialAdapter.js";
import { GenesysDialerAdapter } from "./adapters/dialer/genesysAdapter.js";
import { TwilioDialerAdapter } from "./adapters/dialer/twilioAdapter.js";
import { GenericRestDialerAdapter } from "./adapters/dialer/genericDialerAdapter.js";
import { GenericWebhookAdapter } from "./adapters/webhook/genericWebhookAdapter.js";

const crmAdapters = new Map<IntegrationProviderName, CrmAdapter>();
const dialerAdapters = new Map<IntegrationProviderName, DialerAdapter>();
const webhookAdapters = new Map<IntegrationProviderName, WebhookAdapter>();

// Register CRM Adapters
const sf = new SalesforceCrmAdapter();
const hs = new HubSpotCrmAdapter();
const zoho = new ZohoCrmAdapter();
const customCrm = new GenericRestCrmAdapter();

crmAdapters.set("salesforce", sf);
crmAdapters.set("hubspot", hs);
crmAdapters.set("zoho", zoho);
crmAdapters.set("custom_rest_crm", customCrm);

// Register Dialer Adapters
const vici = new VicidialDialerAdapter();
const gen = new GenesysDialerAdapter();
const twilio = new TwilioDialerAdapter();
const customDialer = new GenericRestDialerAdapter();

dialerAdapters.set("vicidial", vici);
dialerAdapters.set("genesys", gen);
dialerAdapters.set("twilio", twilio);
dialerAdapters.set("custom_rest_dialer", customDialer);

// Register Webhook Adapters
const genericWebhook = new GenericWebhookAdapter();
webhookAdapters.set("generic_webhook", genericWebhook);
webhookAdapters.set("salesforce", genericWebhook);
webhookAdapters.set("hubspot", genericWebhook);
webhookAdapters.set("zoho", genericWebhook);
webhookAdapters.set("custom_rest_crm", genericWebhook);
webhookAdapters.set("vicidial", genericWebhook);
webhookAdapters.set("genesys", genericWebhook);
webhookAdapters.set("twilio", genericWebhook);
webhookAdapters.set("custom_rest_dialer", genericWebhook);

export function getCrmAdapter(providerName: IntegrationProviderName): CrmAdapter | null {
  return crmAdapters.get(providerName) || null;
}

export function getDialerAdapter(providerName: IntegrationProviderName): DialerAdapter | null {
  return dialerAdapters.get(providerName) || null;
}

export function getWebhookAdapter(providerName: IntegrationProviderName): WebhookAdapter {
  return webhookAdapters.get(providerName) || genericWebhook;
}

export function getSupportedProviders(): Array<{
  providerName: IntegrationProviderName;
  providerType: IntegrationProviderType;
  displayName: string;
  authTypes: string[];
  description: string;
}> {
  return [
    {
      providerName: "salesforce",
      providerType: "CRM",
      displayName: "Salesforce CRM",
      authTypes: ["oauth2", "api_key"],
      description: "Bidirectional lead and contact synchronization with Salesforce Enterprise.",
    },
    {
      providerName: "hubspot",
      providerType: "CRM",
      displayName: "HubSpot CRM",
      authTypes: ["api_key", "oauth2"],
      description: "Direct contact and pipeline deal synchronization with HubSpot.",
    },
    {
      providerName: "zoho",
      providerType: "CRM",
      displayName: "Zoho CRM",
      authTypes: ["oauth2", "api_key"],
      description: "Full lead and disposition synchronization with Zoho CRM.",
    },
    {
      providerName: "custom_rest_crm",
      providerType: "CRM",
      displayName: "Custom REST CRM",
      authTypes: ["api_key", "basic_auth", "token"],
      description: "Generic REST API adapter for proprietary enterprise CRM systems.",
    },
    {
      providerName: "vicidial",
      providerType: "DIALER",
      displayName: "Vicidial Telephony",
      authTypes: ["api_key", "basic_auth"],
      description: "Call logs, agent status, and secure recording integration with Vicidial.",
    },
    {
      providerName: "genesys",
      providerType: "DIALER",
      displayName: "Genesys Cloud",
      authTypes: ["oauth2", "token"],
      description: "Omnichannel analytics and call detail integration with Genesys Cloud.",
    },
    {
      providerName: "twilio",
      providerType: "DIALER",
      displayName: "Twilio / Flex",
      authTypes: ["api_key", "basic_auth"],
      description: "Voice call logs, webhooks, and recording management with Twilio Voice.",
    },
    {
      providerName: "custom_rest_dialer",
      providerType: "DIALER",
      displayName: "Custom REST Dialer",
      authTypes: ["api_key", "webhook_secret", "token"],
      description: "Generic webhook and REST ingestion for proprietary dialers.",
    },
  ];
}
