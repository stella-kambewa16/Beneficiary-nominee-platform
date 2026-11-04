import { useState } from 'react'
import { useData } from '../data/context'
import { navigate } from '../router'
import type { RouteState } from '../router'
import { Icon } from '../components/Icon'
import { AllocationBar, NomineeStatusBadge, PolicyStatusBadge } from '../components/Badges'
import { useToast } from '../components/toast-context'
import { formatCurrency, formatDate, initials } from '../lib/format'
import type { Nominee, Policy, Relationship } from '../data/types'

const relationships: Relationship[] = [
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Extended family',
  'Other',
]

const steps = [
  { title: 'Policy', text: 'Select policy holder' },
  { title: 'Nominees', text: 'Capture beneficiary details' },
  { title: 'Allocation', text: 'Assign cover shares' },
  { title: 'Review', text: 'Confirm and submit' },
]

interface NomineeForm {
  name: string
  relationship: Relationship
  idNumber: string
  dob: string
  phone: string
  email: string
  primary: boolean
}

interface NomineeDraft extends NomineeForm {
  key: string
  allocation: number
}

const emptyForm: NomineeForm = {
  name: '',
  relationship: 'Spouse',
  idNumber: '',
  dob: '',
  phone: '',
  email: '',
  primary: false,
}

let draftSequence = 0

function nextDraftKey(): string {
  draftSequence += 1
  return `draft-${draftSequence}`
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validatePhone(value: string): boolean {
  return /^[+0-9 ()-]{7,20}$/.test(value)
}

export function NewNominationPage({ route }: { route: RouteState }) {
  const { policies, nominees, addNomination } = useData()
  const { notify } = useToast()

  const requestedPolicy = route.query.get('policy') ?? ''
  const [policyId, setPolicyId] = useState(
    policies.some((policy) => policy.id === requestedPolicy)
      ? requestedPolicy
      : '',
  )
  const [step, setStep] = useState(0)
  const [drafts, setDrafts] = useState<NomineeDraft[]>([])
  const [form, setForm] = useState<NomineeForm>({ ...emptyForm })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [submitted, setSubmitted] = useState<{
    reference: string
    policy: Policy
    nominees: Nominee[]
  } | null>(null)

  const policy = policies.find((item) => item.id === policyId)
  const existingNominees = policy
    ? nominees.filter((nominee) => nominee.policyId === policy.id)
    : []
  const remainingForPolicy = policy ? 100 - policy.allocated : 100
  const draftTotal = drafts.reduce((sum, draft) => sum + draft.allocation, 0)
  const remainingAfterDrafts = remainingForPolicy - draftTotal

  const updateForm = <K extends keyof NomineeForm,>(
    key: K,
    value: NomineeForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const handlePolicyChange = (value: string) => {
    setPolicyId(value)
    setDrafts([])
    setErrors({})
    setConfirmed(false)
  }

  const handleAddNominee = () => {
    const nextErrors: Record<string, string> = {}

    if (form.name.trim().length < 3) {
      nextErrors.name = 'Enter the nominee’s full name.'
    }
    if (!form.idNumber.trim()) {
      nextErrors.idNumber = 'A national ID or passport number is required.'
    }
    if (form.email && !validateEmail(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (form.phone && !validatePhone(form.phone.trim())) {
      nextErrors.phone = 'Enter a valid phone number.'
    }

    const duplicate = [...existingNominees, ...drafts].some(
      (item) =>
        item.idNumber.trim().toLowerCase() ===
        form.idNumber.trim().toLowerCase(),
    )
    if (duplicate) {
      nextErrors.idNumber = 'This identity number is already on the policy.'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    const shouldBePrimary = drafts.length === 0 ? true : form.primary
    const draft: NomineeDraft = {
      ...form,
      name: form.name.trim(),
      idNumber: form.idNumber.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      primary: shouldBePrimary,
      allocation: 0,
      key: nextDraftKey(),
    }

    setDrafts((current) => {
      const next = shouldBePrimary
        ? current.map((item) => ({ ...item, primary: false }))
        : current
      return [...next, draft]
    })
    setForm({ ...emptyForm })
    setErrors({})
  }

  const removeDraft = (key: string) => {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.key !== key)
      if (next.length && !next.some((draft) => draft.primary)) {
        next[0] = { ...next[0], primary: true }
      }
      return next
    })
  }

  const updateAllocation = (key: string, value: string) => {
    const parsed = value === '' ? 0 : Number(value)
    const allocation = Number.isFinite(parsed)
      ? Math.max(0, Math.min(100, parsed))
      : 0
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, allocation } : draft,
      ),
    )
    setErrors((current) => {
      if (!current.allocation) return current
      const next = { ...current }
      delete next.allocation
      return next
    })
  }

  const goNext = () => {
    const nextErrors: Record<string, string> = {}

    if (step === 0) {
      if (!policy) {
        nextErrors.policy = 'Select a policy to continue.'
      } else if (policy.status === 'Lapsed') {
        nextErrors.policy = 'Lapsed policies cannot accept new nominations.'
      } else if (remainingForPolicy <= 0) {
        nextErrors.policy = 'This policy is already 100% allocated.'
      }
    }

    if (step === 1 && drafts.length === 0) {
      nextErrors.nominees = 'Add at least one nominee before continuing.'
    }

    if (step === 2) {
      if (draftTotal <= 0) {
        nextErrors.allocation = 'Assign allocation to at least one nominee.'
      } else if (remainingAfterDrafts < 0) {
        nextErrors.allocation = `Allocation exceeds the available cover by ${Math.abs(
          remainingAfterDrafts,
        )}%.`
      } else if (drafts.some((draft) => draft.allocation <= 0)) {
        nextErrors.allocation = 'Every nominee needs an allocation above 0%.'
      }
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setStep((current) => Math.min(3, current + 1))
  }

  const goBack = () => {
    setErrors({})
    setStep((current) => Math.max(0, current - 1))
  }

  const handleSubmit = () => {
    if (!policy) return
    if (!confirmed) {
      setErrors({ confirm: 'Confirm the declaration before submitting.' })
      return
    }

    const result = addNomination(
      policy.id,
      drafts.map((draft) => ({
        name: draft.name,
        relationship: draft.relationship,
        idNumber: draft.idNumber,
        dob: draft.dob,
        phone: draft.phone,
        email: draft.email,
        allocation: draft.allocation,
        primary: draft.primary,
      })),
    )

    setSubmitted({
      reference: result.reference,
      policy,
      nominees: result.created,
    })
    setErrors({})
    notify(
      'success',
      'Nomination submitted',
      `${result.created.length} nominee${
        result.created.length === 1 ? '' : 's'
      } added to ${policy.id}.`,
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setSubmitted(null)
    setPolicyId('')
    setStep(0)
    setDrafts([])
    setForm({ ...emptyForm })
    setErrors({})
    setConfirmed(false)
  }

  if (submitted) {
    const total = submitted.nominees.reduce(
      (sum, nominee) => sum + nominee.allocation,
      0,
    )
    return (
      <div className="page-stack">
        <section className="success-card">
          <span className="success-icon">
            <Icon name="check" size={28} />
          </span>
          <h1 className="success-title">Nomination submitted</h1>
          <p className="success-text">
            The beneficiary nomination for {submitted.policy.holder} has been
            captured. It now appears in the nominee register with a pending
            verification status.
          </p>
          <span className="success-ref">
            <Icon name="file-check" size={15} />
            {submitted.reference}
          </span>

          <div className="mini-stat-grid" style={{ width: '100%', maxWidth: 560, marginTop: 24 }}>
            <div className="mini-stat">
              <p className="mini-stat-value">{submitted.nominees.length}</p>
              <p className="mini-stat-label">Nominees added</p>
            </div>
            <div className="mini-stat">
              <p className="mini-stat-value">{total}%</p>
              <p className="mini-stat-label">Cover allocated</p>
            </div>
            <div className="mini-stat">
              <p className="mini-stat-value">
                {formatCurrency(submitted.policy.cover * (total / 100))}
              </p>
              <p className="mini-stat-label">Value assigned</p>
            </div>
          </div>

          <div className="success-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate('/nominees')}
            >
              <Icon name="users" size={15} />
              View nominees
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={resetForm}
            >
              <Icon name="plus" size={15} />
              Create another
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => navigate('/')}
            >
              Back to dashboard
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-main">
          <span className="hero-eyebrow">
            <Icon name="pen" size={13} />
            New nomination
          </span>
          <h1 className="hero-title">Capture a beneficiary nomination</h1>
          <p className="hero-text">
            Select the policy, add each nominee, distribute the sum assured and
            review everything before submitting.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigate('/nominees')}
          >
            <Icon name="users" size={15} />
            Nominee register
          </button>
        </div>
      </section>

      <div className="steps" aria-label="Nomination steps">
        {steps.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`step${index === step ? ' is-active' : ''}${
              index < step ? ' is-done' : ''
            }`}
            onClick={() => {
              if (index < step) {
                setErrors({})
                setStep(index)
              }
            }}
            disabled={index > step}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="step-index">
              {index < step ? <Icon name="check" size={13} /> : index + 1}
            </span>
            <span className="step-copy">
              <span className="step-title">{item.title}</span>
              <span className="step-text">{item.text}</span>
            </span>
          </button>
        ))}
      </div>

      {step === 0 ? (
        <section className="form-card">
          <div className="section-heading" style={{ marginBottom: 18 }}>
            <div className="section-heading-copy">
              <h2 className="section-title">Select the policy</h2>
              <p className="section-subtitle">
                Choose the policy that the nomination belongs to.
              </p>
            </div>
          </div>

          <div className="field" style={{ maxWidth: 560 }}>
            <label className="label" htmlFor="policy-select">
              Policy
            </label>
            <select
              id="policy-select"
              className={`select${errors.policy ? ' is-error' : ''}`}
              value={policyId}
              onChange={(event) => handlePolicyChange(event.target.value)}
            >
              <option value="">Select a policy</option>
              {policies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} — {item.holder} ({item.product})
                </option>
              ))}
            </select>
            {errors.policy ? (
              <p className="error-text">
                <Icon name="alert-circle" size={12} />
                {errors.policy}
              </p>
            ) : (
              <p className="help">
                Only active and pending policies can accept new nominations.
              </p>
            )}
          </div>

          {policy ? (
            <>
              <div className="policy-summary" style={{ marginTop: 20 }}>
                <span className="policy-summary-icon">
                  <Icon name="shield" size={20} />
                </span>
                <div className="policy-summary-copy">
                  <p className="policy-summary-title">
                    {policy.holder}
                    <PolicyStatusBadge status={policy.status} />
                  </p>
                  <p className="policy-summary-meta">
                    {policy.id} · {policy.product} · {policy.branch}
                  </p>
                </div>
                <div className="policy-summary-stats">
                  <div className="policy-summary-stat">
                    <strong>{formatCurrency(policy.cover)}</strong>
                    <span>Sum assured</span>
                  </div>
                  <div className="policy-summary-stat">
                    <strong>{policy.allocated}%</strong>
                    <span>Allocated</span>
                  </div>
                  <div className="policy-summary-stat">
                    <strong>{Math.max(remainingForPolicy, 0)}%</strong>
                    <span>Available</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="progress-meta">
                  <span>
                    <strong>Policy allocation</strong>
                  </span>
                  <span>{policy.allocated}% of cover assigned</span>
                </div>
                <AllocationBar value={policy.allocated} />
              </div>

              <div style={{ marginTop: 22 }}>
                <p className="drawer-section-title">
                  Current nominees ({existingNominees.length})
                </p>
                {existingNominees.length ? (
                  existingNominees.map((nominee) => (
                    <div className="drawer-nominee" key={nominee.id}>
                      <span className="table-avatar" aria-hidden="true">
                        {initials(nominee.name)}
                      </span>
                      <div className="drawer-nominee-copy">
                        <p className="drawer-nominee-name">
                          {nominee.name}
                          {nominee.primary ? (
                            <span
                              className="badge badge-green"
                              style={{ marginLeft: 6 }}
                            >
                              Primary
                            </span>
                          ) : null}
                        </p>
                        <p className="drawer-nominee-meta">
                          {nominee.relationship} · {nominee.allocation}% ·{' '}
                          {formatDate(nominee.nominatedOn)}
                        </p>
                      </div>
                      <NomineeStatusBadge status={nominee.status} />
                    </div>
                  ))
                ) : (
                  <p className="help">
                    This policy has no nominees yet. You will add the first
                    nominee in the next step.
                  </p>
                )}
              </div>

              {policy.status === 'Lapsed' ? (
                <div className="notice" style={{ marginTop: 18 }}>
                  <Icon name="alert-circle" size={14} className="notice-icon" />
                  <span>
                    This policy has lapsed. Reinstate it before capturing a new
                    nomination.
                  </span>
                </div>
              ) : remainingForPolicy <= 0 ? (
                <div className="notice is-success" style={{ marginTop: 18 }}>
                  <Icon name="check-circle" size={14} className="notice-icon" />
                  <span>
                    This policy is fully allocated. You can still review the
                    existing nominees, but no additional cover is available.
                  </span>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => navigate('/policies')}
            >
              Cancel
            </button>
            <div className="form-actions-right">
              <button
                type="button"
                className="button button-primary"
                onClick={goNext}
              >
                Continue
                <Icon name="arrow-right" size={15} />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="form-card">
          <div className="section-heading" style={{ marginBottom: 18 }}>
            <div className="section-heading-copy">
              <h2 className="section-title">Add nominee details</h2>
              <p className="section-subtitle">
                Capture each beneficiary one at a time. You can add more than one
                nominee.
              </p>
            </div>
            <div className="section-actions">
              <span className="chip">
                <Icon name="users" size={12} />
                {drafts.length} added
              </span>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleAddNominee()
            }}
          >
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor="nominee-name">
                  Full name
                </label>
                <input
                  id="nominee-name"
                  className={`input${errors.name ? ' is-error' : ''}`}
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="e.g. Sipho Moyo"
                  autoComplete="name"
                />
                {errors.name ? (
                  <p className="error-text">
                    <Icon name="alert-circle" size={12} />
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label className="label" htmlFor="nominee-relationship">
                  Relationship
                </label>
                <select
                  id="nominee-relationship"
                  className="select"
                  value={form.relationship}
                  onChange={(event) =>
                    updateForm(
                      'relationship',
                      event.target.value as Relationship,
                    )
                  }
                >
                  {relationships.map((relationship) => (
                    <option key={relationship} value={relationship}>
                      {relationship}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-row" style={{ marginTop: 16 }}>
              <div className="field">
                <label className="label" htmlFor="nominee-id">
                  National ID / passport
                </label>
                <input
                  id="nominee-id"
                  className={`input${errors.idNumber ? ' is-error' : ''}`}
                  value={form.idNumber}
                  onChange={(event) =>
                    updateForm('idNumber', event.target.value)
                  }
                  placeholder="e.g. 86-1234568-B-41"
                />
                {errors.idNumber ? (
                  <p className="error-text">
                    <Icon name="alert-circle" size={12} />
                    {errors.idNumber}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label className="label" htmlFor="nominee-dob">
                  Date of birth <span className="optional">Optional</span>
                </label>
                <input
                  id="nominee-dob"
                  type="date"
                  className="input"
                  value={form.dob}
                  onChange={(event) => updateForm('dob', event.target.value)}
                />
              </div>
            </div>

            <div className="field-row" style={{ marginTop: 16 }}>
              <div className="field">
                <label className="label" htmlFor="nominee-phone">
                  Phone <span className="optional">Optional</span>
                </label>
                <input
                  id="nominee-phone"
                  type="tel"
                  className={`input${errors.phone ? ' is-error' : ''}`}
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                  placeholder="+263 77 000 0000"
                  autoComplete="tel"
                />
                {errors.phone ? (
                  <p className="error-text">
                    <Icon name="alert-circle" size={12} />
                    {errors.phone}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label className="label" htmlFor="nominee-email">
                  Email <span className="optional">Optional</span>
                </label>
                <input
                  id="nominee-email"
                  type="email"
                  className={`input${errors.email ? ' is-error' : ''}`}
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  placeholder="nominee@example.com"
                  autoComplete="email"
                />
                {errors.email ? (
                  <p className="error-text">
                    <Icon name="alert-circle" size={12} />
                    {errors.email}
                  </p>
                ) : null}
              </div>
            </div>

            <label className="checkbox-row" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={form.primary}
                onChange={(event) =>
                  updateForm('primary', event.target.checked)
                }
              />
              Make this the primary nominee
            </label>

            <div style={{ marginTop: 16 }}>
              <button
                type="submit"
                className="button button-secondary button-small"
              >
                <Icon name="plus" size={14} />
                Add nominee to nomination
              </button>
            </div>
          </form>

          {errors.nominees ? (
            <p className="error-text" style={{ marginTop: 14 }}>
              <Icon name="alert-circle" size={12} />
              {errors.nominees}
            </p>
          ) : null}

          {drafts.length ? (
            <div className="draft-list">
              {drafts.map((draft) => (
                <div className="draft-card" key={draft.key}>
                  <span className="table-avatar" aria-hidden="true">
                    {initials(draft.name)}
                  </span>
                  <div className="draft-head">
                    <p className="draft-name">
                      {draft.name}
                      {draft.primary ? (
                        <span className="badge badge-green">Primary</span>
                      ) : null}
                    </p>
                    <p className="draft-meta">
                      {draft.relationship} · {draft.idNumber}
                      {draft.phone ? ` · ${draft.phone}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="draft-remove"
                    onClick={() => removeDraft(draft.key)}
                    aria-label={`Remove ${draft.name}`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={goBack}
            >
              <Icon name="chevron-left" size={15} />
              Back
            </button>
            <div className="form-actions-right">
              <button
                type="button"
                className="button button-primary"
                onClick={goNext}
              >
                Continue to allocation
                <Icon name="arrow-right" size={15} />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="form-card">
          <div className="section-heading" style={{ marginBottom: 18 }}>
            <div className="section-heading-copy">
              <h2 className="section-title">Assign allocation</h2>
              <p className="section-subtitle">
                Distribute the available cover across the nominees you added.
              </p>
            </div>
          </div>

          <div className="alloc-summary">
            <div className="alloc-summary-copy">
              <p className="alloc-summary-title">
                {policy ? `${policy.holder} · ${policy.id}` : 'Policy'}
              </p>
              <p className="alloc-summary-text">
                {remainingForPolicy}% available before this nomination ·{' '}
                {draftTotal}% assigned below
              </p>
            </div>
            <div className="alloc-summary-value">
              <strong>{Math.max(remainingAfterDrafts, 0)}%</strong>
              <span>Remaining to allocate</span>
            </div>
          </div>

          <div className="progress-meta">
            <span>
              <strong>Nomination coverage</strong>
            </span>
            <span>
              {draftTotal}% of {remainingForPolicy}% available
            </span>
          </div>
          <AllocationBar
            value={
              remainingForPolicy > 0
                ? (draftTotal / remainingForPolicy) * 100
                : 0
            }
          />

          {errors.allocation ? (
            <div className="notice" style={{ marginTop: 14 }}>
              <Icon name="alert-circle" size={14} className="notice-icon" />
              <span>{errors.allocation}</span>
            </div>
          ) : null}

          <div className="alloc-list" style={{ marginTop: 18 }}>
            {drafts.map((draft) => (
              <div className="alloc-row" key={draft.key}>
                <div className="alloc-person">
                  <span className="table-avatar" aria-hidden="true">
                    {initials(draft.name)}
                  </span>
                  <div>
                    <span className="alloc-name">
                      {draft.name}
                      {draft.primary ? (
                        <span
                          className="badge badge-green"
                          style={{ marginLeft: 6 }}
                        >
                          Primary
                        </span>
                      ) : null}
                    </span>
                    <span className="alloc-meta">
                      {draft.relationship} · {draft.idNumber}
                    </span>
                  </div>
                </div>
                <div className="alloc-input-wrap">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="alloc-input"
                    value={draft.allocation === 0 ? '' : draft.allocation}
                    placeholder="0"
                    onChange={(event) =>
                      updateAllocation(draft.key, event.target.value)
                    }
                    aria-label={`Allocation for ${draft.name}`}
                  />
                  <span className="alloc-input-suffix">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={goBack}
            >
              <Icon name="chevron-left" size={15} />
              Back
            </button>
            <div className="form-actions-right">
              <button
                type="button"
                className="button button-primary"
                onClick={goNext}
              >
                Review nomination
                <Icon name="arrow-right" size={15} />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="form-card">
          <div className="section-heading" style={{ marginBottom: 18 }}>
            <div className="section-heading-copy">
              <h2 className="section-title">Review and submit</h2>
              <p className="section-subtitle">
                Check the details below before submitting the nomination.
              </p>
            </div>
          </div>

          <div className="review-grid">
            <div className="review-block">
              <p className="review-label">Policy holder</p>
              <p className="review-value">{policy?.holder}</p>
              <p className="review-sub">
                {policy?.id} · {policy?.product}
              </p>
            </div>
            <div className="review-block">
              <p className="review-label">Branch</p>
              <p className="review-value">{policy?.branch}</p>
              <p className="review-sub">Sum assured {formatCurrency(policy?.cover ?? 0)}</p>
            </div>
            <div className="review-block">
              <p className="review-label">Nominees</p>
              <p className="review-value">{drafts.length} beneficiaries</p>
              <p className="review-sub">Each with a defined cover share</p>
            </div>
            <div className="review-block">
              <p className="review-label">Allocation</p>
              <p className="review-value">{draftTotal}% of cover</p>
              <p className="review-sub">
                {formatCurrency((policy?.cover ?? 0) * (draftTotal / 100))}{' '}
                assigned
              </p>
            </div>
          </div>

          <div className="draft-list">
            {drafts.map((draft) => (
              <div className="draft-card" key={draft.key}>
                <span className="table-avatar" aria-hidden="true">
                  {initials(draft.name)}
                </span>
                <div className="draft-head">
                  <p className="draft-name">
                    {draft.name}
                    {draft.primary ? (
                      <span className="badge badge-green">Primary</span>
                    ) : null}
                  </p>
                  <p className="draft-meta">
                    {draft.relationship} · {draft.idNumber} · {draft.allocation}%
                    {draft.phone ? ` · ${draft.phone}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <label
            className="checkbox-row"
            style={{ marginTop: 20, alignItems: 'flex-start' }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => {
                setConfirmed(event.target.checked)
                setErrors((current) => {
                  if (!current.confirm) return current
                  const next = { ...current }
                  delete next.confirm
                  return next
                })
              }}
              style={{ marginTop: 2 }}
            />
            <span>
              I confirm that the nominee details are accurate and that the
              policy holder has authorised this nomination.
            </span>
          </label>
          {errors.confirm ? (
            <p className="error-text" style={{ marginTop: 8 }}>
              <Icon name="alert-circle" size={12} />
              {errors.confirm}
            </p>
          ) : null}

          <div className="notice is-info" style={{ marginTop: 18 }}>
            <Icon name="info" size={14} className="notice-icon" />
            <span>
              Submitted nominees start in a pending verification state. This is
              a front-end demo — no records leave the browser.
            </span>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={goBack}
            >
              <Icon name="chevron-left" size={15} />
              Back
            </button>
            <div className="form-actions-right">
              <button
                type="button"
                className="button button-primary"
                onClick={handleSubmit}
              >
                <Icon name="send" size={15} />
                Submit nomination
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
