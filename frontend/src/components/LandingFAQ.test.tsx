import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import LandingFAQ from './LandingFAQ'

describe('LandingFAQ', () => {
  it('renders the section header', () => {
    render(<LandingFAQ />)
    expect(screen.getByText(/FREQUENTLY ASKED/i)).toBeInTheDocument()
    expect(screen.getByText('QUESTIONS')).toBeInTheDocument()
  })

  it('opens the first question by default so the section never looks empty', () => {
    render(<LandingFAQ />)
    // The first FAQ is the beta notice — the answer body calls out that the
    // platform is in an open beta and free for everyone during that window.
    expect(screen.getByText(/open beta \/ proof-of-concept/i)).toBeInTheDocument()
  })

  it('surfaces the "free during beta" commitment up front', () => {
    // Explicit assertion: the beta FAQ must make the free-for-everyone
    // commitment visible without the visitor having to hunt for it.
    render(<LandingFAQ />)
    // The sentence splits around a <strong> tag, so match a substring that
    // sits inside the same node rather than the cross-tag phrase.
    expect(screen.getByText(/free for everyone/i)).toBeInTheDocument()
    expect(screen.getByText(/veterans.*and.*employers/i)).toBeInTheDocument()
  })

  it('collapses the first when a different question is clicked and opens the new one', async () => {
    const user = userEvent.setup()
    render(<LandingFAQ />)

    // Initially: beta answer visible, another ("regular job board") hidden.
    expect(screen.getByText(/open beta \/ proof-of-concept/i)).toBeInTheDocument()
    expect(screen.queryByText(/Job boards match titles/i)).not.toBeInTheDocument()

    // Click the "regular job board" question button.
    await user.click(screen.getByRole('button', { name: /regular job board/i }))

    // The old answer is gone, the new one is visible.
    expect(screen.queryByText(/open beta \/ proof-of-concept/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Job boards match titles/i)).toBeInTheDocument()
  })

  it('closes an open question when its own header is clicked again', async () => {
    const user = userEvent.setup()
    render(<LandingFAQ />)

    // First is open by default — click the beta question to close it.
    await user.click(screen.getByRole('button', { name: /production-ready, or is this a beta/i }))
    expect(screen.queryByText(/open beta \/ proof-of-concept/i)).not.toBeInTheDocument()
  })

  it('tags each FAQ with an audience chip (veteran / employer / platform)', () => {
    render(<LandingFAQ />)
    // At least one of each kind should render somewhere on the page.
    expect(screen.getAllByText('VETERAN').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EMPLOYER').length).toBeGreaterThan(0)
    expect(screen.getAllByText('PLATFORM').length).toBeGreaterThan(0)
  })

  it('exposes the "free during the current beta" line on the employer pricing question', async () => {
    const user = userEvent.setup()
    render(<LandingFAQ />)

    // The employer pricing answer sits behind its own accordion — open it.
    await user.click(screen.getByRole('button', { name: /pricing work for employers/i }))
    expect(screen.getByText(/Free during the current beta/i)).toBeInTheDocument()
  })
})
