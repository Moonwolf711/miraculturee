/**
 * Admin cleanup routes — bulk operations for fake/test accounts
 */

import type { FastifyInstance } from 'fastify';

export default async function adminCleanupRoutes(app: FastifyInstance) {
  /**
   * DELETE /admin/cleanup/fake-accounts
   * Remove all fake accounts (edmtrain.miraculture.com emails)
   */
  app.delete('/cleanup/fake-accounts', async (req) => {
    const { confirm } = req.body as { confirm?: boolean };
    
    if (!confirm) {
      throw Object.assign(
        new Error('Must confirm deletion by setting confirm: true'),
        { statusCode: 400 }
      );
    }

    // Find all fake accounts
    const fakeUsers = await app.prisma.user.findMany({
      where: {
        email: {
          contains: '@edmtrain.miraculture.com'
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        artist: {
          select: { id: true }
        }
      }
    });

    if (fakeUsers.length === 0) {
      return { message: 'No fake accounts found', deleted: 0 };
    }

    // Use transaction to ensure all deletions succeed or fail together
    const result = await app.prisma.$transaction(async (tx) => {
      const userIds = fakeUsers.map(u => u.id);
      const artistIds = fakeUsers
        .filter(u => u.artist)
        .map(u => u.artist!.id);

      // Delete in correct order to handle foreign key constraints
      
      // 1. Delete artist-related data first
      if (artistIds.length > 0) {
        await tx.artistSocialAccount.deleteMany({
          where: { artistId: { in: artistIds } }
        });

        await tx.campaign.deleteMany({
          where: { artistId: { in: artistIds } }
        });

        await tx.event.deleteMany({
          where: { artistId: { in: artistIds } }
        });

        await tx.artist.deleteMany({
          where: { id: { in: artistIds } }
        });
      }

      // 2. Delete user-related data
      await tx.supportTicket.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.raffleEntry.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.transaction.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.notification.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.directTicket.deleteMany({
        where: { ownerId: { in: userIds } }
      });

      await tx.suspiciousActivity.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.passkey.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.socialLogin.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.connectedAccount.deleteMany({
        where: { userId: { in: userIds } }
      });

      await tx.developerInvite.deleteMany({
        where: { 
          OR: [
            { invitedById: { in: userIds } },
            { acceptedById: { in: userIds } }
          ]
        }
      });

      // 3. Finally delete the users
      const deletedUsers = await tx.user.deleteMany({
        where: { id: { in: userIds } }
      });

      return {
        deletedUsers: deletedUsers.count,
        deletedArtists: artistIds.length,
        accounts: fakeUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role
        }))
      };
    });

    return {
      message: `Successfully deleted ${result.deletedUsers} fake accounts`,
      deleted: result.deletedUsers,
      artistsDeleted: result.deletedArtists,
      accounts: result.accounts
    };
  });

  /**
   * GET /admin/cleanup/fake-accounts/preview
   * Preview fake accounts that would be deleted
   */
  app.get('/cleanup/fake-accounts/preview', async () => {
    const fakeUsers = await app.prisma.user.findMany({
      where: {
        email: {
          contains: '@edmtrain.miraculture.com'
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        artist: {
          select: {
            id: true,
            stageName: true,
            isVerified: true
          }
        },
        _count: {
          select: {
            supportTickets: true,
            raffleEntries: true,
            transactions: true,
            notifications: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const artistCount = fakeUsers.filter(u => u.artist).length;
    const totalActivity = fakeUsers.reduce((sum, user) => {
      return sum + user._count.supportTickets + user._count.raffleEntries + 
             user._count.transactions + user._count.notifications;
    }, 0);

    return {
      count: fakeUsers.length,
      artistCount,
      totalActivity,
      accounts: fakeUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        isArtist: !!u.artist,
        artistName: u.artist?.stageName,
        isVerified: u.artist?.isVerified,
        activityCount: u._count.supportTickets + u._count.raffleEntries + 
                      u._count.transactions + u._count.notifications
      }))
    };
  });

  /**
   * DELETE /admin/cleanup/test-accounts
   * Remove accounts with test-related names/emails
   */
  app.delete('/cleanup/test-accounts', async (req) => {
    const { confirm } = req.body as { confirm?: boolean };
    
    if (!confirm) {
      throw Object.assign(
        new Error('Must confirm deletion by setting confirm: true'),
        { statusCode: 400 }
      );
    }

    // Find test accounts by pattern
    const testUsers = await app.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'test', mode: 'insensitive' } },
          { name: { contains: 'test', mode: 'insensitive' } },
          { email: { startsWith: 'test' } },
          { email: { endsWith: '.test' } }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        artist: {
          select: { id: true }
        }
      }
    });

    if (testUsers.length === 0) {
      return { message: 'No test accounts found', deleted: 0 };
    }

    // Similar deletion process as fake accounts
    const result = await app.prisma.$transaction(async (tx) => {
      const userIds = testUsers.map(u => u.id);
      const artistIds = testUsers
        .filter(u => u.artist)
        .map(u => u.artist!.id);

      // Delete artist-related data
      if (artistIds.length > 0) {
        await tx.artistSocialAccount.deleteMany({
          where: { artistId: { in: artistIds } }
        });
        await tx.campaign.deleteMany({
          where: { artistId: { in: artistIds } }
        });
        await tx.event.deleteMany({
          where: { artistId: { in: artistIds } }
        });
        await tx.artist.deleteMany({
          where: { id: { in: artistIds } }
        });
      }

      // Delete user-related data
      await tx.supportTicket.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.raffleEntry.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.transaction.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.notification.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.directTicket.deleteMany({
        where: { ownerId: { in: userIds } }
      });
      await tx.suspiciousActivity.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.passkey.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.socialLogin.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.connectedAccount.deleteMany({
        where: { userId: { in: userIds } }
      });
      await tx.developerInvite.deleteMany({
        where: { 
          OR: [
            { invitedById: { in: userIds } },
            { acceptedById: { in: userIds } }
          ]
        }
      });

      const deletedUsers = await tx.user.deleteMany({
        where: { id: { in: userIds } }
      });

      return {
        deletedUsers: deletedUsers.count,
        deletedArtists: artistIds.length,
        accounts: testUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role
        }))
      };
    });

    return {
      message: `Successfully deleted ${result.deletedUsers} test accounts`,
      deleted: result.deletedUsers,
      artistsDeleted: result.deletedArtists,
      accounts: result.accounts
    };
  });
}