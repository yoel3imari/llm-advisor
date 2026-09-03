import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Slider } from './Slider';

describe('shadcn Slider Component', () => {
  it('renders slider primitive and slider thumb', () => {
    render(<Slider min={512} max={32768} step={512} value={[4096]} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeDefined();
    expect(slider.getAttribute('aria-valuenow')).toBe('4096');
    expect(slider.getAttribute('aria-valuemin')).toBe('512');
    expect(slider.getAttribute('aria-valuemax')).toBe('32768');
  });

  it('forwards ref properly to root element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Slider ref={ref} value={[2048]} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });
});
