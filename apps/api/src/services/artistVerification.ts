import type { PrismaClient, SocialProvider } from '@prisma/client';
import { encrypt } from '../lib/crypto.js';

interface SocialAccountData {
  provider: SocialProvider;
  providerUserId: string;
  providerUsername: string | null;
  profileUrl: string | null;
  followerCount: number | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scopes: string | null;
  rawProfile: object;
}

export class ArtistVerificationService {
  constructor(private prisma: PrismaClient) {}

  /** Upsert a social account for an artist and update verification status. */
  async connectSocialAccount(artistId: string, data: SocialAccountData) {
    const encryptedAccess = encrypt(data.accessToken);
    const encryptedRefresh = data.refreshToken ? encrypt(data.refreshToken) : null;

    const account = await this.prisma.artistSocialAccount.upsert({
      where: {
        artistId_provider: { artistId, provider: data.provider },
      },
      create: {
        artistId,
        provider: data.provider,
        providerUserId: data.providerUserId,
        providerUsername: data.providerUsername,
        profileUrl: data.profileUrl,
        followerCount: data.followerCount,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        rawProfile: data.rawProfile as any,
        lastVerifiedAt: new Date(),
      },
      update: {
        providerUserId: data.providerUserId,
        providerUsername: data.providerUsername,
        profileUrl: data.profileUrl,
        followerCount: data.followerCount,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        rawProfile: data.rawProfile as any,
        lastVerifiedAt: new Date(),
      },
    });

    await this.updateVerificationStatus(artistId);
    return account;
  }

  /** Disconnect a social account and recompute verification status. */
  async disconnectSocialAccount(artistId: string, provider: SocialProvider) {
    await this.prisma.artistSocialAccount.deleteMany({
      where: { artistId, provider },
    });
    await this.updateVerificationStatus(artistId);
  }

  /** List all connected social accounts for an artist (tokens excluded). */
  async getSocialAccounts(artistId: string) {
    return this.prisma.artistSocialAccount.findMany({
      where: { artistId },
      select: {
        id: true,
        provider: true,
        providerUsername: true,
        profileUrl: true,
        followerCount: true,
        connectedAt: true,
        lastVerifiedAt: true,
      },
    });
  }

  /** Recalculate verification: verified if at least one social account is connected. */
  private async updateVerificationStatus(artistId: string) {
    const count = await this.prisma.artistSocialAccount.count({ where: { artistId } });
    const isVerified = count > 0;

    await this.prisma.artist.update({
      where: { id: artistId },
      data: {
        isVerified,
        verificationStatus: isVerified ? 'VERIFIED' : 'UNVERIFIED',
        verifiedAt: isVerified ? new Date() : null,
      },
    });
  }
}
