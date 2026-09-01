import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { HouseholdTransitionsService } from './household-transitions.service';

describe('HouseholdTransitionsService readiness check', () => {
  it('reports only recorded household facts and identifies missing records', async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const prisma = {
      account: { count },
      insurancePolicy: { count },
      recurringTransaction: { count },
      estateDocument: { count },
      householdTransitionPlan: { count },
      householdTransitionContact: { count },
      trustedAccessGrant: { count },
    } as unknown as PrismaService;

    await expect(
      new HouseholdTransitionsService(prisma).readinessCheck('household-1'),
    ).resolves.toMatchObject({
      recordedCount: 4,
      totalCount: 8,
      checks: expect.arrayContaining([
        expect.objectContaining({ id: 'accounts', recorded: true }),
        expect.objectContaining({ id: 'insurance', recorded: false }),
        expect.objectContaining({ id: 'trusted-access', recorded: false }),
      ]),
    });
  });
});

describe('HouseholdTransitionsService trusted access', () => {
  it('stores only a hash of a one-time invitation code and records the invitation', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'invite-1',
      recipientEmail: 'spouse@example.com',
      scopes: ['HANDOFF_SUMMARY'],
      status: 'PENDING',
      expiresAt: new Date('2026-09-06T00:00:00.000Z'),
    });
    const auditCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          trustedAccessInvitation: { create },
          trustedAccessAuditEvent: { create: auditCreate },
        }),
      ),
    } as unknown as PrismaService;

    const result = await new HouseholdTransitionsService(prisma).createTrustedAccessInvitation(
      'owner-1',
      'Spouse@Example.com',
      ['HANDOFF_SUMMARY'],
    );

    expect(result.invitationCode).toHaveLength(32);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'owner-1',
          recipientEmail: 'spouse@example.com',
          scopes: ['HANDOFF_SUMMARY'],
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(create.mock.calls[0][0].data.tokenHash).not.toBe(result.invitationCode);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'INVITED' }) }),
    );
  });

  it('requires the addressed spouse to accept before creating an active grant', async () => {
    const invitation = {
      id: 'invite-1',
      ownerUserId: 'owner-1',
      recipientEmail: 'spouse@example.com',
      scopes: ['HANDOFF_SUMMARY'],
      status: 'PENDING',
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    };
    const upsert = vi.fn().mockResolvedValue({
      id: 'grant-1',
      scopes: ['HANDOFF_SUMMARY'],
      approvedAt: new Date('2026-08-30T00:00:00.000Z'),
    });
    const invitationUpdate = vi.fn().mockResolvedValue({});
    const auditCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      trustedAccessInvitation: { findUnique: vi.fn().mockResolvedValue(invitation) },
      $transaction: vi.fn((callback) =>
        callback({
          trustedAccessGrant: { upsert },
          trustedAccessInvitation: { update: invitationUpdate },
          trustedAccessAuditEvent: { create: auditCreate },
        }),
      ),
    } as unknown as PrismaService;
    const service = new HouseholdTransitionsService(prisma);

    await expect(
      service.acceptTrustedAccessInvitation('spouse-user', 'other@example.com', 'a'.repeat(32)),
    ).rejects.toThrow('not addressed to the authenticated user');

    await expect(
      service.acceptTrustedAccessInvitation('spouse-user', 'Spouse@Example.com', 'a'.repeat(32)),
    ).resolves.toMatchObject({ grantId: 'grant-1', scopes: ['HANDOFF_SUMMARY'] });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ ownerUserId: 'owner-1', recipientUserId: 'spouse-user' }),
      }),
    );
    expect(invitationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'APPROVED' }) }),
    );
  });

  it('returns only an explicitly shared snapshot to an active approved recipient', async () => {
    const findManyGrants = vi.fn().mockResolvedValue([{ id: 'grant-1', ownerUserId: 'owner-1' }]);
    const findFirstSummary = vi.fn().mockResolvedValue({
      id: 'summary-1',
      payload: { notice: 'Owner-approved planning summary' },
      sharedAt: new Date('2026-08-30T00:00:00.000Z'),
      createdAt: new Date('2026-08-30T00:00:00.000Z'),
    });
    const auditCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      trustedAccessGrant: { findMany: findManyGrants },
      handoffSummary: { findFirst: findFirstSummary },
      trustedAccessAuditEvent: { create: auditCreate },
    } as unknown as PrismaService;

    await expect(
      new HouseholdTransitionsService(prisma).sharedHandoffSummary('spouse-user'),
    ).resolves.toMatchObject({
      id: 'summary-1',
      payload: { notice: 'Owner-approved planning summary' },
    });
    expect(findManyGrants).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientUserId: 'spouse-user',
          isActive: true,
          scopes: { has: 'HANDOFF_SUMMARY' },
        }),
      }),
    );
    expect(findFirstSummary).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner-1', sharedAt: { not: null } } }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'HANDOFF_SUMMARY_VIEWED' }),
      }),
    );
  });

  it('makes an accepted household member the Wardkeep lead only after a manual transition', async () => {
    const householdUpdate = vi.fn().mockResolvedValue({});
    const membershipUpdate = vi.fn().mockResolvedValue({
      role: 'SURVIVING_HOUSEHOLD_LEAD',
      updatedAt: new Date('2026-08-30T00:00:00.000Z'),
    });
    const auditCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      householdMembership: {
        findUnique: vi.fn().mockResolvedValue({ id: 'membership-1', householdId: 'household-1' }),
      },
      $transaction: vi.fn((callback) =>
        callback({
          household: { update: householdUpdate },
          householdMembership: { update: membershipUpdate },
          trustedAccessAuditEvent: { create: auditCreate },
        }),
      ),
    } as unknown as PrismaService;

    await expect(
      new HouseholdTransitionsService(prisma).activateSurvivingHouseholdLead('spouse-user'),
    ).resolves.toMatchObject({ role: 'SURVIVING_HOUSEHOLD_LEAD' });
    expect(householdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'household-1' },
        data: { ownerUserId: 'spouse-user' },
      }),
    );
    expect(membershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'SURVIVING_HOUSEHOLD_LEAD' } }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'SURVIVING_HOUSEHOLD_LEAD_ACTIVATED' }),
      }),
    );
  });

  it('creates same-household membership only from an accepted membership invitation', async () => {
    const invitation = {
      id: 'invite-1',
      ownerUserId: 'owner-1',
      recipientEmail: 'spouse@example.com',
      scopes: ['HANDOFF_SUMMARY', 'HOUSEHOLD_MEMBER'],
      householdId: 'household-1',
      status: 'PENDING',
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    };
    const membershipUpsert = vi.fn().mockResolvedValue({});
    const prisma = {
      trustedAccessInvitation: { findUnique: vi.fn().mockResolvedValue(invitation) },
      $transaction: vi.fn((callback) =>
        callback({
          trustedAccessGrant: {
            upsert: vi.fn().mockResolvedValue({
              id: 'grant-1',
              scopes: invitation.scopes,
              approvedAt: new Date('2026-08-30T00:00:00.000Z'),
            }),
          },
          householdMembership: { upsert: membershipUpsert },
          trustedAccessInvitation: { update: vi.fn().mockResolvedValue({}) },
          trustedAccessAuditEvent: { create: vi.fn().mockResolvedValue({}) },
        }),
      ),
    } as unknown as PrismaService;

    await new HouseholdTransitionsService(prisma).acceptTrustedAccessInvitation(
      'spouse-user',
      'spouse@example.com',
      'a'.repeat(32),
    );
    expect(membershipUpsert).toHaveBeenCalledWith({
      where: { userId: 'spouse-user' },
      create: { householdId: 'household-1', userId: 'spouse-user' },
      update: { householdId: 'household-1', role: 'MEMBER' },
    });
  });

  it('does not let access alone activate the surviving-household lead role', async () => {
    const prisma = {
      householdMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(
      new HouseholdTransitionsService(prisma).activateSurvivingHouseholdLead('trusted-user'),
    ).rejects.toThrow('accepted same-household membership is required');
  });

  it('emergency-locks all pending invitations and active grants with an audit event', async () => {
    const invitationUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const grantUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          trustedAccessInvitation: { updateMany: invitationUpdateMany },
          trustedAccessGrant: { updateMany: grantUpdateMany },
          trustedAccessAuditEvent: { create: auditCreate },
        }),
      ),
    } as unknown as PrismaService;

    await expect(
      new HouseholdTransitionsService(prisma).emergencyLockTrustedAccess('owner-1'),
    ).resolves.toEqual({ revokedInvitations: 2, revokedGrants: 1 });
    expect(invitationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: 'owner-1', status: 'PENDING' } }),
    );
    expect(grantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: 'owner-1', isActive: true } }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'EMERGENCY_LOCKOUT' }) }),
    );
  });

  it('deletes only the owner’s stored handoff snapshots and audits the deletion', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const auditCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn((callback) =>
        callback({
          handoffSummary: { deleteMany },
          trustedAccessAuditEvent: { create: auditCreate },
        }),
      ),
    } as unknown as PrismaService;

    await expect(
      new HouseholdTransitionsService(prisma).deleteSharedHandoffSummaries('owner-1'),
    ).resolves.toEqual({ deletedCount: 2 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'owner-1' } });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'HANDOFF_SUMMARIES_DELETED' }),
      }),
    );
  });

  it('exports only the owner’s trusted-access records and related audit events', async () => {
    const invitationFindMany = vi.fn().mockResolvedValue([{ id: 'invite-1' }]);
    const grantFindMany = vi.fn().mockResolvedValue([{ id: 'grant-1' }]);
    const auditFindMany = vi.fn().mockResolvedValue([{ event: 'APPROVED' }]);
    const prisma = {
      trustedAccessInvitation: { findMany: invitationFindMany },
      trustedAccessGrant: { findMany: grantFindMany },
      trustedAccessAuditEvent: { findMany: auditFindMany },
    } as unknown as PrismaService;

    await expect(
      new HouseholdTransitionsService(prisma).trustedAccessExport('owner-1'),
    ).resolves.toMatchObject({
      invitations: [{ id: 'invite-1' }],
      grants: [{ id: 'grant-1' }],
      auditEvents: [{ event: 'APPROVED' }],
    });
    expect(invitationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: 'owner-1' } }),
    );
    expect(grantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: 'owner-1' } }),
    );
    expect(auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ invitationId: { in: ['invite-1'] } }, { grantId: { in: ['grant-1'] } }] },
      }),
    );
  });
});
