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
    // The body of the first FAQ (about being free) should be visible.
    expect(screen.getByText(/Veterans never pay a cent/i)).toBeInTheDocument()
  })

  it('collapses the first when a different question is clicked and opens the new one', async () => {
    const user = userEvent.setup()
    render(<LandingFAQ />)

    // Initially: first answer visible, another ("regular job board") hidden.
    expect(screen.getByText(/Veterans never pay a cent/i)).toBeInTheDocument()
    expect(screen.queryByText(/Job boards match titles/i)).not.toBeInTheDocument()

    // Click the "regular job board" question button.
    await user.click(screen.getByRole('button', { name: /regular job board/i }))

    // The old answer is gone, the new one is visible.
    expect(screen.queryByText(/Veterans never pay a cent/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Job boards match titles/i)).toBeInTheDocument()
  })

  it('closes an open question when its own header is clicked again', async () => {
    const user = userEvent.setup()
    render(<LandingFAQ />)

    // First is open by default — click it to close.
    await user.click(screen.getByRole('button', { name: /really free/i }))
    expect(screen.queryByText(/Veterans never pay a cent/i)).not.toBeInTheDocument()
  })

  it('tags each FAQ with an audience chip (veteran / employer / platform)', () => {
    render(<LandingFAQ />)
    // At least one of each kind should render somewhere on the page.
    expect(screen.getAllByText('VETERAN').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EMPLOYER').length).toBeGreaterThan(0)
    expect(screen.getAllByText('PLATFORM').length).toBeGreaterThan(0)
  })
})
