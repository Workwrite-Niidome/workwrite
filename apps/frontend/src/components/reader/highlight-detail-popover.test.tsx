import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HighlightDetailPopover } from './highlight-detail-popover';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="trash-icon">Trash</span>,
  X: () => <span data-testid="x-icon">X</span>,
}));

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

const defaultProps = {
  highlight: {
    id: 'hl-1',
    memo: 'Test memo',
    color: 'yellow',
    episodeId: 'ep-1',
    startPos: 0,
    endPos: 10,
    userId: 'user-1',
    createdAt: new Date().toISOString(),
  },
  position: { top: 100, left: 200 },
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
};

describe('HighlightDetailPopover', () => {
  it('should render with highlight memo in textarea', () => {
    render(<HighlightDetailPopover {...defaultProps} />);

    expect(screen.getByDisplayValue('Test memo')).toBeInTheDocument();
  });

  it('should show 5 color options', () => {
    render(<HighlightDetailPopover {...defaultProps} />);

    const colorButtons = screen.getAllByRole('button').filter(
      btn => btn.className.includes('rounded-full')
    );
    expect(colorButtons.length).toBe(5);
  });

  it('should call onUpdate with changed memo when save is clicked', () => {
    const onUpdate = vi.fn();
    const onClose = vi.fn();
    render(<HighlightDetailPopover {...defaultProps} onUpdate={onUpdate} onClose={onClose} />);

    const textarea = screen.getByDisplayValue('Test memo');
    fireEvent.change(textarea, { target: { value: 'Updated memo' } });

    fireEvent.click(screen.getByText('保存'));

    expect(onUpdate).toHaveBeenCalledWith('hl-1', { memo: 'Updated memo' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should not call onUpdate if nothing changed', () => {
    const onUpdate = vi.fn();
    const onClose = vi.fn();
    render(<HighlightDetailPopover {...defaultProps} onUpdate={onUpdate} onClose={onClose} />);

    fireEvent.click(screen.getByText('保存'));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onDelete and onClose when delete button is clicked', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<HighlightDetailPopover {...defaultProps} onDelete={onDelete} onClose={onClose} />);

    fireEvent.click(screen.getByText('削除'));

    expect(onDelete).toHaveBeenCalledWith('hl-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<HighlightDetailPopover {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('should update color when color button is clicked and save', () => {
    const onUpdate = vi.fn();
    render(<HighlightDetailPopover {...defaultProps} onUpdate={onUpdate} />);

    const blueBtn = screen.getAllByRole('button').find(
      btn => btn.className.includes('bg-blue-400')
    );
    if (blueBtn) fireEvent.click(blueBtn);

    fireEvent.click(screen.getByText('保存'));

    expect(onUpdate).toHaveBeenCalledWith('hl-1', { color: 'blue' });
  });

  it('should render the title text', () => {
    render(<HighlightDetailPopover {...defaultProps} />);

    expect(screen.getByText('ハイライト詳細')).toBeInTheDocument();
  });
});
