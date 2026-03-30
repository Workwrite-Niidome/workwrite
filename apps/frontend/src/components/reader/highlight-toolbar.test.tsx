import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HighlightToolbar } from './highlight-toolbar';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Sparkles: () => <span>Sparkles</span>,
  Save: () => <span>Save</span>,
  X: () => <span>X</span>,
}));

// Mock Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, title, ...props }: any) => (
    <button onClick={onClick} title={title} {...props}>{children}</button>
  ),
}));

const defaultProps = {
  position: { top: 100, left: 200 },
  onSave: vi.fn(),
  onAiExplain: vi.fn(),
  onClose: vi.fn(),
};

describe('HighlightToolbar', () => {
  it('should render 5 color buttons', () => {
    render(<HighlightToolbar {...defaultProps} />);

    const colorButtons = screen.getAllByRole('button').filter(
      btn => btn.className.includes('rounded-full')
    );
    expect(colorButtons.length).toBe(5);
  });

  it('should show memo input when memo button is clicked', () => {
    render(<HighlightToolbar {...defaultProps} />);

    fireEvent.click(screen.getByTitle('メモ'));

    expect(screen.getByPlaceholderText('メモ...')).toBeInTheDocument();
  });

  it('should call onSave with default color and empty memo on quick save', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<HighlightToolbar {...defaultProps} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByText('ハイライト保存'));

    expect(onSave).toHaveBeenCalledWith('yellow', '');
    expect(onClose).toHaveBeenCalled();
  });

  it('should save with memo content', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<HighlightToolbar {...defaultProps} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByTitle('メモ'));

    fireEvent.change(screen.getByPlaceholderText('メモ...'), {
      target: { value: 'Important passage' },
    });

    fireEvent.click(screen.getByText('保存'));

    expect(onSave).toHaveBeenCalledWith('yellow', 'Important passage');
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onAiExplain when AI button is clicked', () => {
    const onAiExplain = vi.fn();
    render(<HighlightToolbar {...defaultProps} onAiExplain={onAiExplain} />);

    fireEvent.click(screen.getByTitle('AI解説'));

    expect(onAiExplain).toHaveBeenCalledTimes(1);
  });

  it('should change selected color', () => {
    const onSave = vi.fn();
    render(<HighlightToolbar {...defaultProps} onSave={onSave} />);

    const greenBtn = screen.getAllByRole('button').find(
      btn => btn.className.includes('bg-green-400')
    );
    if (greenBtn) fireEvent.click(greenBtn);

    fireEvent.click(screen.getByText('ハイライト保存'));

    expect(onSave).toHaveBeenCalledWith('green', '');
  });

  it('should hide quick save button when memo is open', () => {
    render(<HighlightToolbar {...defaultProps} />);

    expect(screen.getByText('ハイライト保存')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('メモ'));

    expect(screen.queryByText('ハイライト保存')).not.toBeInTheDocument();
    expect(screen.getByText('保存')).toBeInTheDocument();
  });
});
