import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

type PlanInput = {
  mode?: 'INCAPACITY_CONTINUITY' | 'AFTER_DEATH_SETTLEMENT';
  title?: string;
  reviewDate?: string | null;
  isActive?: boolean;
  notes?: string | null;
};
type ContactInput = {
  role?: 'INCAPACITY_AGENT' | 'POTENTIAL_EXECUTOR' | 'SURVIVING_HOUSEHOLD_CONTACT';
  name?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};
const TRUSTED_ACCESS_SCOPES = ['HANDOFF_SUMMARY', 'HOUSEHOLD_MEMBER'] as const;
type TrustedAccessScope = (typeof TRUSTED_ACCESS_SCOPES)[number];

@Injectable()
export class HouseholdTransitionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.householdTransitionPlan.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { reviewDate: 'asc' }],
    });
  }

  listContacts(userId: string) {
    return this.prisma.householdTransitionContact.findMany({
      where: { userId },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async householdMembership(userId: string) {
    const ownedHousehold = await this.prisma.household.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (ownedHousehold) return { householdId: ownedHousehold.id, role: 'HOUSEHOLD_OWNER' as const };
    const membership = await this.prisma.householdMembership.findUnique({
      where: { userId },
      select: { householdId: true, role: true },
    });
    return membership;
  }

  createContact(
    userId: string,
    input: ContactInput & { role: NonNullable<ContactInput['role']>; name: string },
  ) {
    return this.prisma.householdTransitionContact.create({
      data: {
        userId,
        role: input.role,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async removeContact(userId: string, id: string) {
    const contact = await this.prisma.householdTransitionContact.findFirst({
      where: { id, userId },
    });
    if (!contact) throw new NotFoundException('Transition contact not found');
    await this.prisma.householdTransitionContact.delete({ where: { id } });
  }

  /** A factual, read-only check of records a household may want to organize. */
  async readinessCheck(userId: string) {
    const reviewedSince = new Date();
    reviewedSince.setUTCFullYear(reviewedSince.getUTCFullYear() - 1);
    const [
      accounts,
      policies,
      obligations,
      estateDocuments,
      plans,
      contacts,
      reviewedPlans,
      trustedGrants,
    ] = await Promise.all([
      this.prisma.account.count({ where: { userId, isArchived: false } }),
      this.prisma.insurancePolicy.count({ where: { userId, isActive: true } }),
      this.prisma.recurringTransaction.count({ where: { userId, isActive: true } }),
      this.prisma.estateDocument.count({ where: { userId, isActive: true } }),
      this.prisma.householdTransitionPlan.count({ where: { userId, isActive: true } }),
      this.prisma.householdTransitionContact.count({ where: { userId } }),
      this.prisma.householdTransitionPlan.count({
        where: { userId, isActive: true, updatedAt: { gte: reviewedSince } },
      }),
      this.prisma.trustedAccessGrant.count({ where: { ownerUserId: userId, isActive: true } }),
    ]);
    const checks = [
      this.check('accounts', 'Accounts and institutions', accounts, 'active account record'),
      this.check('insurance', 'Insurance policies and contacts', policies, 'active policy record'),
      this.check(
        'obligations',
        'Recurring obligations',
        obligations,
        'active recurring obligation',
      ),
      this.check(
        'estate',
        'Estate-document locations',
        estateDocuments,
        'active estate-document record',
      ),
      this.check('plan', 'Continuity plan', plans, 'active transition plan'),
      this.check(
        'recent-review',
        'Plan reviewed in the last year',
        reviewedPlans,
        'recently updated active plan',
      ),
      this.check('contacts', 'Trusted contacts', contacts, 'recorded trusted contact'),
      this.check(
        'trusted-access',
        'Trusted access',
        trustedGrants,
        'active, recipient-approved viewing grant',
      ),
    ];
    return {
      checks,
      recordedCount: checks.filter((check) => check.recorded).length,
      totalCount: checks.length,
    };
  }

  /** Builds an owner-requested organizer summary; it never grants or releases access. */
  async handoffSummary(userId: string) {
    const [accounts, policies, obligations, documents, contacts, plans] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, isArchived: false },
        select: { name: true, type: true, currency: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.insurancePolicy.findMany({
        where: { userId, isActive: true },
        select: { provider: true, nickname: true, type: true, renewalDate: true },
        orderBy: { provider: 'asc' },
      }),
      this.prisma.recurringTransaction.findMany({
        where: { userId, isActive: true },
        select: { merchant: true, expectedAmount: true, frequency: true, nextExpected: true },
        orderBy: { nextExpected: 'asc' },
      }),
      this.prisma.estateDocument.findMany({
        where: { userId, isActive: true },
        select: { type: true, title: true, reviewDate: true },
        orderBy: { type: 'asc' },
      }),
      this.prisma.householdTransitionContact.findMany({
        where: { userId },
        select: { role: true, name: true, email: true, phone: true, notes: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.householdTransitionPlan.findMany({
        where: { userId, isActive: true },
        select: { mode: true, title: true, reviewDate: true, notes: true },
        orderBy: { reviewDate: 'asc' },
      }),
    ]);
    return {
      generatedAt: new Date(),
      notice:
        'Owner-requested planning summary. It does not establish incapacity or death, prove authority, grant access, contain credentials, or direct financial actions. Verify authority and local requirements with appropriate professionals.',
      accounts,
      insurancePolicies: policies,
      recurringObligations: obligations.map((obligation) => ({
        ...obligation,
        expectedAmount: obligation.expectedAmount.toString(),
      })),
      estateDocumentReferences: documents,
      trustedContacts: contacts,
      transitionPlans: plans,
    };
  }

  /** Creates the precise, immutable snapshot an owner has elected to share. */
  async createSharedHandoffSummary(userId: string) {
    const payload = await this.handoffSummary(userId);
    return this.prisma.$transaction(async (tx) => {
      const summary = await tx.handoffSummary.create({
        data: { userId, payload, sharedAt: new Date() },
        select: { id: true, sharedAt: true, createdAt: true },
      });
      await tx.trustedAccessAuditEvent.create({
        data: {
          actorUserId: userId,
          event: 'HANDOFF_SUMMARY_SHARED',
          metadata: { handoffSummaryId: summary.id },
        },
      });
      return summary;
    });
  }

  /** Deletes stored handoff snapshots; it cannot recall files recipients already downloaded. */
  async deleteSharedHandoffSummaries(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.handoffSummary.deleteMany({ where: { userId } });
      await tx.trustedAccessAuditEvent.create({
        data: {
          actorUserId: userId,
          event: 'HANDOFF_SUMMARIES_DELETED',
          metadata: { deletedCount: deleted.count },
        },
      });
      return { deletedCount: deleted.count };
    });
  }

  /** Returns only an owner-shared snapshot to an active, recipient-approved grant holder. */
  async sharedHandoffSummary(recipientUserId: string) {
    const grants = await this.prisma.trustedAccessGrant.findMany({
      where: {
        recipientUserId,
        isActive: true,
        scopes: { has: 'HANDOFF_SUMMARY' },
      },
      select: { id: true, ownerUserId: true },
      take: 2,
    });
    const [grant] = grants;
    if (!grant) throw new NotFoundException('No active handoff-summary access is available');
    if (grants.length > 1)
      throw new BadRequestException('Choose a household before viewing a shared handoff summary');
    const summary = await this.prisma.handoffSummary.findFirst({
      where: { userId: grant.ownerUserId, sharedAt: { not: null } },
      select: { id: true, payload: true, sharedAt: true, createdAt: true },
      orderBy: { sharedAt: 'desc' },
    });
    if (!summary) throw new NotFoundException('The owner has not shared a handoff summary');
    await this.prisma.trustedAccessAuditEvent.create({
      data: {
        grantId: grant.id,
        actorUserId: recipientUserId,
        event: 'HANDOFF_SUMMARY_VIEWED',
        metadata: { handoffSummaryId: summary.id },
      },
    });
    return summary;
  }

  async listTrustedAccess(userId: string) {
    const [invitations, grants] = await Promise.all([
      this.prisma.trustedAccessInvitation.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          recipientEmail: true,
          scopes: true,
          status: true,
          expiresAt: true,
          approvedAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.trustedAccessGrant.findMany({
        where: { ownerUserId: userId, isActive: true },
        select: {
          id: true,
          scopes: true,
          approvedAt: true,
          recipient: { select: { email: true } },
        },
        orderBy: { approvedAt: 'desc' },
      }),
    ]);
    return { invitations, grants };
  }

  /** Creates a copyable, one-time invitation code; Wardkeep does not send it. */
  async createTrustedAccessInvitation(
    userId: string,
    recipientEmail: string,
    scopes: TrustedAccessScope[],
  ) {
    const token = randomBytes(24).toString('base64url');
    const tokenHash = this.hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    const invitation = await this.prisma.$transaction(async (tx) => {
      const household = scopes.includes('HOUSEHOLD_MEMBER')
        ? await tx.household.upsert({
            where: { ownerUserId: userId },
            create: { ownerUserId: userId },
            update: {},
            select: { id: true },
          })
        : null;
      const created = await tx.trustedAccessInvitation.create({
        data: {
          ownerUserId: userId,
          recipientEmail: recipientEmail.toLowerCase(),
          scopes,
          tokenHash,
          expiresAt,
          householdId: household?.id,
        },
        select: { id: true, recipientEmail: true, scopes: true, status: true, expiresAt: true },
      });
      await tx.trustedAccessAuditEvent.create({
        data: {
          invitationId: created.id,
          actorUserId: userId,
          event: 'INVITED',
          metadata: { scopes },
        },
      });
      return created;
    });
    return { ...invitation, invitationCode: token };
  }

  async acceptTrustedAccessInvitation(
    recipientUserId: string,
    recipientEmail: string,
    invitationCode: string,
  ) {
    const tokenHash = this.hashInvitationToken(invitationCode);
    const invitation = await this.prisma.trustedAccessInvitation.findUnique({
      where: { tokenHash },
    });
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) {
      throw new BadRequestException('This trusted-access invitation is invalid or expired');
    }
    if (
      invitation.ownerUserId === recipientUserId ||
      invitation.recipientEmail !== recipientEmail.toLowerCase()
    ) {
      throw new BadRequestException('This invitation is not addressed to the authenticated user');
    }
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.trustedAccessGrant.upsert({
        where: {
          ownerUserId_recipientUserId: { ownerUserId: invitation.ownerUserId, recipientUserId },
        },
        create: { ownerUserId: invitation.ownerUserId, recipientUserId, scopes: invitation.scopes },
        update: {
          scopes: invitation.scopes,
          isActive: true,
          approvedAt: new Date(),
          revokedAt: null,
        },
      });
      if (invitation.householdId && invitation.scopes.includes('HOUSEHOLD_MEMBER')) {
        await tx.householdMembership.upsert({
          where: { userId: recipientUserId },
          create: { householdId: invitation.householdId, userId: recipientUserId },
          update: { householdId: invitation.householdId, role: 'MEMBER' },
        });
      }
      await tx.trustedAccessInvitation.update({
        where: { id: invitation.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      await tx.trustedAccessAuditEvent.create({
        data: {
          invitationId: invitation.id,
          grantId: grant.id,
          actorUserId: recipientUserId,
          event: 'APPROVED',
          metadata: { scopes: invitation.scopes },
        },
      });
      return { grantId: grant.id, scopes: grant.scopes, approvedAt: grant.approvedAt };
    });
  }

  /** Assigns a Wardkeep coordination lead after the member manually confirms the transition. */
  async activateSurvivingHouseholdLead(userId: string) {
    const membership = await this.prisma.householdMembership.findUnique({
      where: { userId },
      select: { id: true, householdId: true },
    });
    if (!membership)
      throw new BadRequestException('An accepted same-household membership is required first');
    return this.prisma.$transaction(async (tx) => {
      await tx.household.update({
        where: { id: membership.householdId },
        data: { ownerUserId: userId },
      });
      const updated = await tx.householdMembership.update({
        where: { id: membership.id },
        data: { role: 'SURVIVING_HOUSEHOLD_LEAD' },
        select: { role: true, updatedAt: true },
      });
      await tx.trustedAccessAuditEvent.create({
        data: {
          actorUserId: userId,
          event: 'SURVIVING_HOUSEHOLD_LEAD_ACTIVATED',
          metadata: { householdId: membership.householdId },
        },
      });
      return updated;
    });
  }

  async revokeTrustedAccessInvitation(userId: string, invitationId: string) {
    const invitation = await this.prisma.trustedAccessInvitation.findFirst({
      where: { id: invitationId, ownerUserId: userId },
    });
    if (!invitation) throw new NotFoundException('Trusted-access invitation not found');
    if (invitation.status !== 'PENDING')
      throw new BadRequestException('Only pending invitations can be revoked');
    await this.prisma.$transaction([
      this.prisma.trustedAccessInvitation.update({
        where: { id: invitationId },
        data: { status: 'REVOKED', revokedAt: new Date() },
      }),
      this.prisma.trustedAccessAuditEvent.create({
        data: { invitationId, actorUserId: userId, event: 'INVITATION_REVOKED', metadata: {} },
      }),
    ]);
  }

  async revokeTrustedAccessGrant(userId: string, grantId: string) {
    const grant = await this.prisma.trustedAccessGrant.findFirst({
      where: { id: grantId, ownerUserId: userId, isActive: true },
    });
    if (!grant) throw new NotFoundException('Active trusted-access grant not found');
    await this.prisma.$transaction([
      this.prisma.trustedAccessGrant.update({
        where: { id: grantId },
        data: { isActive: false, revokedAt: new Date() },
      }),
      this.prisma.trustedAccessAuditEvent.create({
        data: { grantId, actorUserId: userId, event: 'GRANT_REVOKED', metadata: {} },
      }),
    ]);
  }

  /** Immediately revokes every pending invitation and active grant owned by this household user. */
  async emergencyLockTrustedAccess(userId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const [invitations, grants] = await Promise.all([
        tx.trustedAccessInvitation.updateMany({
          where: { ownerUserId: userId, status: 'PENDING' },
          data: { status: 'REVOKED', revokedAt: now },
        }),
        tx.trustedAccessGrant.updateMany({
          where: { ownerUserId: userId, isActive: true },
          data: { isActive: false, revokedAt: now },
        }),
      ]);
      await tx.trustedAccessAuditEvent.create({
        data: {
          actorUserId: userId,
          event: 'EMERGENCY_LOCKOUT',
          metadata: { revokedInvitations: invitations.count, revokedGrants: grants.count },
        },
      });
      return { revokedInvitations: invitations.count, revokedGrants: grants.count };
    });
  }

  /** Exports only the owner's trusted-access records and their related audit history. */
  async trustedAccessExport(userId: string) {
    const [invitations, grants] = await Promise.all([
      this.prisma.trustedAccessInvitation.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          recipientEmail: true,
          scopes: true,
          status: true,
          expiresAt: true,
          approvedAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.trustedAccessGrant.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          scopes: true,
          isActive: true,
          approvedAt: true,
          revokedAt: true,
          createdAt: true,
          recipient: { select: { email: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const audits = await this.prisma.trustedAccessAuditEvent.findMany({
      where: {
        OR: [
          { invitationId: { in: invitations.map((invitation) => invitation.id) } },
          { grantId: { in: grants.map((grant) => grant.id) } },
        ],
      },
      select: {
        invitationId: true,
        grantId: true,
        actorUserId: true,
        event: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      generatedAt: new Date(),
      notice:
        'Owner-requested trusted-access record. It documents Wardkeep access events only and does not establish authority or recover already downloaded files.',
      invitations,
      grants,
      auditEvents: audits,
    };
  }

  private hashInvitationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  create(
    userId: string,
    input: PlanInput & { mode: NonNullable<PlanInput['mode']>; title: string },
  ) {
    return this.prisma.householdTransitionPlan.create({
      data: {
        userId,
        mode: input.mode,
        title: input.title,
        reviewDate: input.reviewDate ? new Date(`${input.reviewDate}T00:00:00.000Z`) : null,
        notes: input.notes ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: PlanInput) {
    const plan = await this.prisma.householdTransitionPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Household transition plan not found');
    return this.prisma.householdTransitionPlan.update({
      where: { id },
      data: {
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.reviewDate !== undefined
          ? { reviewDate: input.reviewDate ? new Date(`${input.reviewDate}T00:00:00.000Z`) : null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    const plan = await this.prisma.householdTransitionPlan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Household transition plan not found');
    await this.prisma.householdTransitionPlan.delete({ where: { id } });
  }

  private check(id: string, label: string, count: number, noun: string) {
    return {
      id,
      label,
      recorded: count > 0,
      detail: count ? `${count} ${noun}${count === 1 ? '' : 's'} found.` : `No ${noun}s found.`,
    };
  }
}
