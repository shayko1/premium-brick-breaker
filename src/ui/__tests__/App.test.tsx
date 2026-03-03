import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App shell', () => {
  it('renders Hebrew title and start button', () => {
    render(<App />);
    expect(screen.getByText('שובר לבנים — פרימיום')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /התחל/i })).toBeInTheDocument();
  });
});
