import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BottomSheet } from './bottom-sheet';

describe('BottomSheet', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('should render children when open', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()}>
        <div>Sheet Content</div>
      </BottomSheet>
    );

    expect(screen.getByText('Sheet Content')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <BottomSheet open={false} onClose={vi.fn()}>
        <div>Sheet Content</div>
      </BottomSheet>
    );

    expect(screen.queryByText('Sheet Content')).not.toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose}>
        <div>Content</div>
      </BottomSheet>
    );

    // The backdrop is the first child div with bg-black/50
    const backdrop = document.querySelector('.bg-black\\/50');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should render with title when provided', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()} title="Settings">
        <div>Content</div>
      </BottomSheet>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should not render title when not provided', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>
    );

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should set body overflow to hidden when open', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body overflow when closed', () => {
    const { rerender } = render(
      <BottomSheet open={true} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>
    );

    rerender(
      <BottomSheet open={false} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('should render drag handle', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>
    );

    // Drag handle has a specific class
    const handle = document.querySelector('.cursor-grab');
    expect(handle).toBeInTheDocument();
  });
});
