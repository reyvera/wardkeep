'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, HeartHandshake, Trash2, UsersRound, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Plan = {
  id: string;
  mode: 'INCAPACITY_CONTINUITY' | 'AFTER_DEATH_SETTLEMENT';
  title: string;
  reviewDate: string | null;
  notes: string | null;
  isActive: boolean;
};
type Check = { id: string; label: string; recorded: boolean; detail: string };
type ReadinessCheck = { checks: Check[]; recordedCount: number; totalCount: number };
type Contact = {
  id: string;
  role: 'INCAPACITY_AGENT' | 'POTENTIAL_EXECUTOR' | 'SURVIVING_HOUSEHOLD_CONTACT';
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};
type TrustedAccessInvitation = {
  id: string;
  recipientEmail: string;
  scopes: string[];
  status: 'PENDING' | 'APPROVED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
type TrustedAccessGrant = {
  id: string;
  scopes: string[];
  approvedAt: string;
  recipient: { email: string };
};
type TrustedAccess = { invitations: TrustedAccessInvitation[]; grants: TrustedAccessGrant[] };
type HouseholdMembership = {
  householdId: string;
  role: 'HOUSEHOLD_OWNER' | 'MEMBER' | 'SURVIVING_HOUSEHOLD_LEAD';
} | null;
const label = (mode: Plan['mode']) =>
  mode === 'INCAPACITY_CONTINUITY' ? 'Incapacity continuity plan' : 'After-death settlement plan';
const contactRoleLabel: Record<Contact['role'], string> = {
  INCAPACITY_AGENT: 'Incapacity agent',
  POTENTIAL_EXECUTOR: 'Potential executor / personal representative',
  SURVIVING_HOUSEHOLD_CONTACT: 'Surviving-household contact',
};
const planningPrompts = [
  {
    title: 'Immediate arrangements',
    items: [
      'Record any wishes or preferences you have chosen to note.',
      'Identify who should coordinate a memorial or other arrangements.',
      'Consider whether a local professional should be consulted.',
    ],
  },
  {
    title: 'Notifications',
    items: [
      'List people or organizations you may want to notify.',
      'Confirm which contacts are recorded and how to reach them.',
      'Decide who, if anyone, should coordinate communications.',
    ],
  },
  {
    title: 'Bills and documents',
    items: [
      'Review recurring obligations and their next expected dates.',
      'Confirm document locations and review dates are recorded.',
      'Identify missing account, policy, or instruction details.',
    ],
  },
  {
    title: 'Professional support',
    items: [
      'Note any attorney, tax, financial, medical, or grief-support contacts you choose to keep.',
      'Verify authority, terminology, and next steps for your jurisdiction.',
      'Review the plan periodically while the household can do so together.',
    ],
  },
];
const survivingHouseholdSteps = [
  {
    title: 'Pause and identify immediate support',
    detail:
      'Use emergency, medical, personal-support, or local professional resources as appropriate. Wardkeep does not report or verify a death.',
  },
  {
    title: 'Review the household record',
    detail:
      'Check the accounts, policies, recurring obligations, document locations, and contacts already recorded here.',
  },
  {
    title: 'Confirm authority outside Wardkeep',
    detail:
      'Authority to act comes from applicable institutions and law, not from a Wardkeep plan, contact, or access invitation.',
  },
  {
    title: 'Organize notifications and near-term obligations',
    detail:
      'Use the recorded contacts and recurring-obligation list to identify items you may need to review. Do not rely on Wardkeep as an instruction source.',
  },
  {
    title: 'Revisit household readiness',
    detail:
      'As records change, use the readiness results to see which factual areas are incomplete or need a review.',
  },
];

export default function HouseholdTransitionsPage() {
  const client = useQueryClient();
  const [form, setForm] = useState({
    mode: 'INCAPACITY_CONTINUITY' as Plan['mode'],
    title: '',
    reviewDate: '',
    notes: '',
  });
  const [contactForm, setContactForm] = useState({
    role: 'INCAPACITY_AGENT' as Contact['role'],
    name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [approvedHandoff, setApprovedHandoff] = useState(false);
  const [approvedSharedHandoff, setApprovedSharedHandoff] = useState(false);
  const [confirmedHandoffDeletion, setConfirmedHandoffDeletion] = useState(false);
  const [showSurvivingHouseholdWalkthrough, setShowSurvivingHouseholdWalkthrough] = useState(false);
  const [trustedAccessEmail, setTrustedAccessEmail] = useState('');
  const [sameHouseholdMember, setSameHouseholdMember] = useState(false);
  const [confirmedEmergencyLock, setConfirmedEmergencyLock] = useState(false);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [receivedInvitationCode, setReceivedInvitationCode] = useState('');
  const plans = useQuery({
    queryKey: ['household-transitions'],
    queryFn: () => apiClient.get<Plan[]>('/household-transitions'),
  });
  const contacts = useQuery({
    queryKey: ['household-transitions', 'contacts'],
    queryFn: () => apiClient.get<Contact[]>('/household-transitions/contacts'),
  });
  const readiness = useQuery({
    queryKey: ['household-transitions', 'readiness-check'],
    queryFn: () => apiClient.get<ReadinessCheck>('/household-transitions/readiness-check'),
  });
  const trustedAccess = useQuery({
    queryKey: ['household-transitions', 'trusted-access'],
    queryFn: () => apiClient.get<TrustedAccess>('/household-transitions/trusted-access'),
  });
  const householdMembership = useQuery({
    queryKey: ['household-transitions', 'household-membership'],
    queryFn: () =>
      apiClient.get<HouseholdMembership>('/household-transitions/household-membership'),
  });
  const downloadHandoff = useMutation({
    mutationFn: () => apiClient.get('/household-transitions/handoff-summary'),
    onSuccess: (summary) => {
      const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'wardkeep-owner-approved-handoff-summary.json';
      link.click();
      URL.revokeObjectURL(url);
    },
  });
  const shareHandoff = useMutation({
    mutationFn: () =>
      apiClient.post<{ id: string; sharedAt: string }>(
        '/household-transitions/handoff-summary/share',
        {
          confirmed: true,
        },
      ),
  });
  const deleteSharedHandoffSummaries = useMutation({
    mutationFn: () =>
      apiClient.post<{ deletedCount: number }>(
        '/household-transitions/handoff-summary/delete-all',
        {
          confirmed: true,
        },
      ),
    onSuccess: () => setConfirmedHandoffDeletion(false),
  });
  const downloadSharedHandoff = useMutation({
    mutationFn: () =>
      apiClient.get<{ payload: unknown }>('/household-transitions/trusted-access/handoff-summary'),
    onSuccess: (summary) => {
      const blob = new Blob([JSON.stringify(summary.payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'wardkeep-owner-shared-handoff-summary.json';
      link.click();
      URL.revokeObjectURL(url);
    },
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['household-transitions'] });
  };
  const create = useMutation({
    mutationFn: () =>
      apiClient.post('/household-transitions', {
        ...form,
        reviewDate: form.reviewDate || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      setForm({ mode: 'INCAPACITY_CONTINUITY', title: '', reviewDate: '', notes: '' });
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiClient.patch(`/household-transitions/${id}`, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/household-transitions/${id}`),
    onSuccess: refresh,
  });
  const createContact = useMutation({
    mutationFn: () =>
      apiClient.post('/household-transitions/contacts', {
        ...contactForm,
        email: contactForm.email || null,
        phone: contactForm.phone || null,
        notes: contactForm.notes || null,
      }),
    onSuccess: () => {
      setContactForm({ role: 'INCAPACITY_AGENT', name: '', email: '', phone: '', notes: '' });
      refresh();
    },
  });
  const removeContact = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/household-transitions/contacts/${id}`),
    onSuccess: refresh,
  });
  const createTrustedAccess = useMutation({
    mutationFn: () =>
      apiClient.post<TrustedAccessInvitation & { invitationCode: string }>(
        '/household-transitions/trusted-access/invitations',
        {
          recipientEmail: trustedAccessEmail,
          scopes: sameHouseholdMember
            ? ['HANDOFF_SUMMARY', 'HOUSEHOLD_MEMBER']
            : ['HANDOFF_SUMMARY'],
        },
      ),
    onSuccess: (invitation) => {
      setInvitationCode(invitation.invitationCode);
      setTrustedAccessEmail('');
      setSameHouseholdMember(false);
      refresh();
    },
  });
  const acceptTrustedAccess = useMutation({
    mutationFn: () =>
      apiClient.post('/household-transitions/trusted-access/accept', {
        invitationCode: receivedInvitationCode,
      }),
    onSuccess: () => {
      setReceivedInvitationCode('');
      refresh();
    },
  });
  const revokeTrustedAccessInvitation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/household-transitions/trusted-access/invitations/${id}`),
    onSuccess: refresh,
  });
  const revokeTrustedAccessGrant = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/household-transitions/trusted-access/grants/${id}`),
    onSuccess: refresh,
  });
  const emergencyLockTrustedAccess = useMutation({
    mutationFn: () =>
      apiClient.post<{ revokedInvitations: number; revokedGrants: number }>(
        '/household-transitions/trusted-access/emergency-lock',
        { confirmed: true },
      ),
    onSuccess: () => {
      setConfirmedEmergencyLock(false);
      refresh();
    },
  });
  const downloadTrustedAccessExport = useMutation({
    mutationFn: () => apiClient.get('/household-transitions/trusted-access/export'),
    onSuccess: (record) => {
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'wardkeep-trusted-access-record.json';
      link.click();
      URL.revokeObjectURL(url);
    },
  });
  const activateSurvivingHouseholdLead = useMutation({
    mutationFn: () =>
      apiClient.post<{ role: string }>('/household-transitions/surviving-household/lead', {
        confirmed: true,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['household-transitions', 'household-membership'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Household transition plans</h1>
        <p className="mt-1 text-sm text-content-secondary">
          A neutral organizer for continuity planning and after-death settlement preparation.
          Recording a plan does not establish incapacity, death, legal authority, or access for
          anyone.
        </p>
      </div>
      <div className="card border-accent-yellow/30 bg-accent-yellow/5 text-sm text-content-secondary">
        Store planning notes and locations—not legal, identity, medical, funeral, or
        financial-document contents. No plan here changes accounts, authentication, ownership, or
        permissions.
      </div>
      <section className="card" aria-labelledby="handoff-summary-heading">
        <h2 id="handoff-summary-heading" className="card-title">
          OWNER-APPROVED HANDOFF SUMMARY
        </h2>
        <p className="mt-1 text-sm text-content-secondary">
          Download a private organizer summary of the information you have recorded. It is generated
          only when you choose it; Wardkeep never releases it automatically based on inactivity or a
          reported event.
        </p>
        <label className="mt-3 flex items-start gap-2 text-sm text-content-secondary">
          <input
            type="checkbox"
            className="mt-1"
            checked={approvedHandoff}
            onChange={(event) => setApprovedHandoff(event.target.checked)}
          />
          I am the household owner and approve creating this summary now.
        </label>
        <button
          className="btn-secondary mt-3"
          disabled={!approvedHandoff || downloadHandoff.isPending}
          onClick={() => downloadHandoff.mutate()}
        >
          Download summary
        </button>
        <div className="mt-4 border-t border-edge pt-4">
          <label className="flex items-start gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              className="mt-1"
              checked={approvedSharedHandoff}
              onChange={(event) => setApprovedSharedHandoff(event.target.checked)}
            />
            I approve sharing a new, immutable copy of this summary with people who already have
            active, recipient-approved handoff access.
          </label>
          <button
            type="button"
            className="btn-secondary mt-3"
            disabled={!approvedSharedHandoff || shareHandoff.isPending}
            onClick={() => shareHandoff.mutate()}
          >
            Create and share snapshot
          </button>
          {shareHandoff.isSuccess && (
            <p className="mt-2 text-xs text-accent-green">
              Shared snapshot created. Future changes will require a new owner-approved snapshot.
            </p>
          )}
          <div className="mt-4 border-t border-edge pt-4">
            <p className="text-sm font-medium text-content-primary">Delete stored snapshots</p>
            <p className="mt-1 text-xs text-content-secondary">
              This removes every handoff-summary snapshot stored by Wardkeep. It cannot recall a
              file another person has already downloaded.
            </p>
            <label className="mt-3 flex items-start gap-2 text-xs text-content-secondary">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmedHandoffDeletion}
                onChange={(event) => setConfirmedHandoffDeletion(event.target.checked)}
              />
              I understand this permanently deletes all stored handoff snapshots.
            </label>
            <button
              type="button"
              className="btn-secondary mt-3 text-accent-red"
              disabled={!confirmedHandoffDeletion || deleteSharedHandoffSummaries.isPending}
              onClick={() => deleteSharedHandoffSummaries.mutate()}
            >
              Delete stored snapshots
            </button>
            {deleteSharedHandoffSummaries.isSuccess && (
              <p className="mt-2 text-xs text-accent-green">
                Deleted {deleteSharedHandoffSummaries.data.deletedCount} stored snapshot(s).
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="card" aria-labelledby="surviving-household-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="surviving-household-heading" className="card-title">
              SURVIVING-HOUSEHOLD WALKTHROUGH
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              If a death has been confirmed, a spouse or other household member can use this neutral
              organizing walkthrough. Starting it does not report an event, designate a head of
              household, or change access or authority.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => setShowSurvivingHouseholdWalkthrough((visible) => !visible)}
          >
            {showSurvivingHouseholdWalkthrough ? 'Hide walkthrough' : 'Start walkthrough'}
          </button>
        </div>
        {showSurvivingHouseholdWalkthrough && (
          <>
            <ol className="mt-4 space-y-3">
              {survivingHouseholdSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-3 rounded-lg border border-edge bg-surface-secondary p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-purple/15 text-xs font-semibold text-accent-purple">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-content-primary">{step.title}</p>
                    <p className="mt-1 text-xs text-content-secondary">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-edge pt-4">
              <p className="text-xs text-content-secondary">
                If you are an accepted same-household member and are choosing to coordinate this
                Wardkeep household, you may activate its surviving-household lead role. This is not
                a legal designation and does not transfer financial authority.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3"
                disabled={activateSurvivingHouseholdLead.isPending}
                onClick={() => activateSurvivingHouseholdLead.mutate()}
              >
                Become Wardkeep household lead
              </button>
              {activateSurvivingHouseholdLead.isSuccess && (
                <p className="mt-2 text-xs text-accent-green">
                  Wardkeep household lead activated. Continue using the walkthrough; outside
                  authority remains separate.
                </p>
              )}
            </div>
          </>
        )}
      </section>
      <section className="card" aria-labelledby="trusted-access-heading">
        <div className="flex items-start gap-3">
          <UsersRound className="mt-0.5 text-accent-purple" size={20} />
          <div>
            <h2 id="trusted-access-heading" className="card-title">
              TRUSTED HANDOFF ACCESS
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              Invite a spouse or another trusted person to establish explicit, revocable consent for
              a future owner-approved handoff summary. They must accept with their own Wardkeep
              account. No household data is released through this setup step.
            </p>
          </div>
        </div>
        {householdMembership.data && (
          <p className="mt-3 rounded-lg border border-edge bg-surface-secondary p-3 text-xs text-content-secondary">
            Wardkeep household role:{' '}
            <span className="font-medium text-content-primary">
              {householdMembership.data.role === 'HOUSEHOLD_OWNER'
                ? 'Household owner'
                : householdMembership.data.role === 'SURVIVING_HOUSEHOLD_LEAD'
                  ? 'Surviving-household lead'
                  : 'Co-household member'}
            </span>
            . This is a Wardkeep coordination role only.
          </p>
        )}
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            createTrustedAccess.mutate();
          }}
        >
          <input
            className="input flex-1"
            required
            type="email"
            value={trustedAccessEmail}
            onChange={(event) => setTrustedAccessEmail(event.target.value)}
            placeholder="Trusted person's email"
          />
          <label className="flex items-start gap-2 text-xs text-content-secondary sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={sameHouseholdMember}
              onChange={(event) => setSameHouseholdMember(event.target.checked)}
            />
            This person lives in the same household. Their acceptance will also create a Wardkeep
            co-household membership; it does not share financial records or establish authority.
          </label>
          <button className="btn-primary" disabled={createTrustedAccess.isPending}>
            Create invitation
          </button>
        </form>
        {invitationCode && (
          <div className="mt-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 p-3">
            <p className="text-sm font-medium text-content-primary">
              Share this code privately now
            </p>
            <p className="mt-1 break-all font-mono text-xs text-content-secondary">
              {invitationCode}
            </p>
            <p className="mt-2 text-xs text-content-secondary">
              It is shown once, expires after seven days, and can be revoked while pending.
            </p>
          </div>
        )}
        <div className="mt-4 border-t border-edge pt-4">
          <p className="text-sm font-medium text-content-primary">Accept an invitation</p>
          <p className="mt-1 text-xs text-content-secondary">
            Sign in to your own account, then enter the code sent to the email address on the
            invitation. Accepting records consent; it does not reveal household information.
          </p>
          <form
            className="mt-3 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              acceptTrustedAccess.mutate();
            }}
          >
            <input
              className="input flex-1 font-mono"
              required
              value={receivedInvitationCode}
              onChange={(event) => setReceivedInvitationCode(event.target.value)}
              placeholder="Invitation code"
            />
            <button className="btn-secondary" disabled={acceptTrustedAccess.isPending}>
              Accept invitation
            </button>
          </form>
          <button
            type="button"
            className="btn-secondary mt-3"
            disabled={downloadSharedHandoff.isPending}
            onClick={() => downloadSharedHandoff.mutate()}
          >
            Download owner-shared summary
          </button>
        </div>
        {trustedAccess.data?.invitations.length ? (
          <ul className="mt-4 space-y-2">
            {trustedAccess.data.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface-secondary p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-content-primary">
                    {invitation.recipientEmail}
                  </p>
                  <p className="mt-1 text-xs text-content-secondary">
                    {invitation.status.toLowerCase()} · expires{' '}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {invitation.status === 'PENDING' && (
                  <button
                    type="button"
                    className="btn-ghost p-1 text-content-tertiary hover:text-accent-red"
                    aria-label={`Revoke invitation for ${invitation.recipientEmail}`}
                    onClick={() => revokeTrustedAccessInvitation.mutate(invitation.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {trustedAccess.data?.grants.length ? (
          <div className="mt-4 border-t border-edge pt-4">
            <p className="text-sm font-medium text-content-primary">Active handoff access</p>
            <p className="mt-1 text-xs text-content-secondary">
              Revoking access immediately prevents new shared-summary downloads. It does not erase
              files a recipient has already downloaded.
            </p>
            <ul className="mt-3 space-y-2">
              {trustedAccess.data.grants.map((grant) => (
                <li
                  key={grant.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface-secondary p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content-primary">
                      {grant.recipient.email}
                    </p>
                    <p className="mt-1 text-xs text-content-secondary">
                      Handoff-summary access · accepted{' '}
                      {new Date(grant.approvedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost p-1 text-content-tertiary hover:text-accent-red"
                    aria-label={`Revoke handoff access for ${grant.recipient.email}`}
                    onClick={() => revokeTrustedAccessGrant.mutate(grant.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-4 border-t border-edge pt-4">
          <p className="text-sm font-medium text-content-primary">Access record export</p>
          <p className="mt-1 text-xs text-content-secondary">
            Download your invitations, grants, and related Wardkeep audit events for your records.
          </p>
          <button
            type="button"
            className="btn-secondary mt-3"
            disabled={downloadTrustedAccessExport.isPending}
            onClick={() => downloadTrustedAccessExport.mutate()}
          >
            Download access record
          </button>
        </div>
        <div className="mt-4 border-t border-edge pt-4">
          <p className="text-sm font-medium text-content-primary">Emergency access lockout</p>
          <p className="mt-1 text-xs text-content-secondary">
            This immediately revokes all pending invitations and active handoff access. It does not
            erase a summary a recipient has already downloaded.
          </p>
          <label className="mt-3 flex items-start gap-2 text-xs text-content-secondary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmedEmergencyLock}
              onChange={(event) => setConfirmedEmergencyLock(event.target.checked)}
            />
            I understand this removes all current trusted access for this Wardkeep household.
          </label>
          <button
            type="button"
            className="btn-secondary mt-3 text-accent-red"
            disabled={!confirmedEmergencyLock || emergencyLockTrustedAccess.isPending}
            onClick={() => emergencyLockTrustedAccess.mutate()}
          >
            Lock all trusted access
          </button>
          {emergencyLockTrustedAccess.isSuccess && (
            <p className="mt-2 text-xs text-accent-green">
              Trusted access locked: {emergencyLockTrustedAccess.data.revokedInvitations}{' '}
              invitation(s) and {emergencyLockTrustedAccess.data.revokedGrants} grant(s) revoked.
            </p>
          )}
        </div>
      </section>
      <section className="card" aria-labelledby="planning-prompts-heading">
        <h2 id="planning-prompts-heading" className="card-title">
          OPTIONAL PLANNING PROMPTS
        </h2>
        <p className="mt-1 text-sm text-content-secondary">
          Use these as an organizing checklist if helpful. They do not create arrangements, send
          notifications, or provide legal, tax, financial, medical, or funeral-direction advice.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {planningPrompts.map((group) => (
            <div
              key={group.title}
              className="rounded-lg border border-edge bg-surface-secondary p-4"
            >
              <h3 className="text-sm font-medium text-content-primary">{group.title}</h3>
              <ul className="mt-2 space-y-2 text-xs text-content-secondary">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true">□</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section className="card" aria-labelledby="record-check-heading">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="record-check-heading" className="card-title mb-1">
              WHAT YOU HAVE ON FILE
            </h2>
            <p className="text-sm text-content-secondary">
              {readiness.data
                ? `Wardkeep found ${readiness.data.recordedCount} of ${readiness.data.totalCount} kinds of information.`
                : 'Checking what you have entered…'}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {readiness.data?.checks.map((check) => (
            <div key={check.id} className="rounded-lg border border-edge bg-surface-secondary p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-content-primary">
                {check.recorded ? (
                  <CheckCircle2 size={16} className="text-accent-green" />
                ) : (
                  <XCircle size={16} className="text-accent-yellow" />
                )}
                {check.label}
              </div>
              <p className="mt-1 text-xs text-content-secondary">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>
      <form
        className="card grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <label className="input-label">Plan type</label>
          <select
            className="input"
            value={form.mode}
            onChange={(event) => setForm({ ...form, mode: event.target.value as Plan['mode'] })}
          >
            <option value="INCAPACITY_CONTINUITY">Incapacity continuity</option>
            <option value="AFTER_DEATH_SETTLEMENT">After-death settlement</option>
          </select>
        </div>
        <div>
          <label className="input-label">Plan title</label>
          <input
            className="input"
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="e.g. Household continuity review"
          />
        </div>
        <div>
          <label className="input-label">Review date (optional)</label>
          <input
            className="input"
            type="date"
            value={form.reviewDate}
            onChange={(event) => setForm({ ...form, reviewDate: event.target.value })}
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={create.isPending}>
            Add plan
          </button>
        </div>
      </form>
      <section className="card" aria-labelledby="trusted-contacts-heading">
        <div className="flex items-start gap-3">
          <UsersRound className="mt-0.5 text-accent-purple" size={20} />
          <div>
            <h2 id="trusted-contacts-heading" className="card-title">
              RECORDED TRUSTED CONTACTS
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              These are planning contacts only. A recorded designation does not prove authority,
              grant access, bypass authentication, or replace jurisdiction-specific legal
              verification.
            </p>
          </div>
        </div>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            createContact.mutate();
          }}
        >
          <div>
            <label className="input-label">Planning role</label>
            <select
              className="input"
              value={contactForm.role}
              onChange={(event) =>
                setContactForm({ ...contactForm, role: event.target.value as Contact['role'] })
              }
            >
              {Object.entries(contactRoleLabel).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Name</label>
            <input
              className="input"
              required
              value={contactForm.name}
              onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Email (optional)</label>
            <input
              className="input"
              type="email"
              value={contactForm.email}
              onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Phone (optional)</label>
            <input
              className="input"
              value={contactForm.phone}
              onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={createContact.isPending}>
              Record contact
            </button>
          </div>
        </form>
        {contacts.isLoading ? (
          <div className="mt-4 text-sm text-content-secondary">Loading contacts…</div>
        ) : contacts.data?.length === 0 ? (
          <p className="mt-4 text-sm text-content-tertiary">No trusted contacts recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {contacts.data?.map((contact) => (
              <li
                key={contact.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-edge bg-surface-secondary p-3"
              >
                <div>
                  <p className="text-sm font-medium text-content-primary">{contact.name}</p>
                  <p className="mt-1 text-xs text-content-secondary">
                    {contactRoleLabel[contact.role]}
                    {contact.email ? ` · ${contact.email}` : ''}
                    {contact.phone ? ` · ${contact.phone}` : ''}
                  </p>
                  {contact.notes && (
                    <p className="mt-1 text-xs text-content-tertiary">{contact.notes}</p>
                  )}
                </div>
                <button
                  className="btn-ghost p-1 text-content-tertiary hover:text-accent-red"
                  onClick={() => removeContact.mutate(contact.id)}
                  aria-label={`Remove ${contact.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {plans.isLoading ? (
        <div className="card skeleton h-32" />
      ) : plans.data?.length === 0 ? (
        <div className="card py-12 text-center text-sm text-content-secondary">
          No transition plans recorded yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {plans.data?.map((plan) => (
            <li key={plan.id} className="card">
              <div className="flex gap-3">
                <HeartHandshake className="mt-0.5 text-accent-purple" size={20} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-content-primary">{plan.title}</p>
                      <p className="mt-1 text-sm text-content-secondary">
                        {label(plan.mode)}
                        {plan.reviewDate
                          ? ` · review ${new Date(plan.reviewDate).toLocaleDateString()}`
                          : ''}
                      </p>
                      {plan.notes && (
                        <p className="mt-2 text-xs text-content-tertiary">{plan.notes}</p>
                      )}
                    </div>
                    <button
                      className="btn-ghost p-2 text-content-tertiary hover:text-accent-red"
                      onClick={() => remove.mutate(plan.id)}
                      aria-label={`Delete ${plan.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <button
                    className="btn-secondary mt-3 text-xs"
                    onClick={() =>
                      update.mutate({ id: plan.id, body: { isActive: !plan.isActive } })
                    }
                  >
                    <Archive size={14} />
                    {plan.isActive ? 'Archive plan' : 'Restore plan'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
