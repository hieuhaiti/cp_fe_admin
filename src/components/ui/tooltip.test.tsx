import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './tooltip'

describe('Tooltip Component', () => {
  it('renders trigger button correctly', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">Di chuột vào tôi</button>
          </TooltipTrigger>
          <TooltipContent>Nội dung gợi ý</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.getByRole('button', { name: 'Di chuột vào tôi' })).toBeInTheDocument()
  })

  it('displays tooltip content on hover/focus', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">Hành động</button>
          </TooltipTrigger>
          <TooltipContent>Gợi ý chi tiết</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Hành động' })
    await user.hover(trigger)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Gợi ý chi tiết')
  })
})
