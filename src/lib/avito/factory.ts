import { AvitoClient } from "@/lib/avito/client";
import { saveAvitoOAuthTokens } from "@/lib/settings";

export type AvitoClientSettings = {
  clientId: string;
  clientSecret: string;
  avitoUserId?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | string | null;
};

export function createAvitoClient(settings: AvitoClientSettings) {
  return new AvitoClient({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    accountId: settings.avitoUserId,
    accessToken: settings.accessToken,
    refreshToken: settings.refreshToken,
    tokenExpiresAt: settings.tokenExpiresAt,
    onTokenUpdate: saveAvitoOAuthTokens,
  });
}
