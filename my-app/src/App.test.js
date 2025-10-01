import { render, screen } from '@testing-library/react';
import App from './App';

test('renders birthday title', () => {
  render(<App />);
  const titleElement = screen.getByText(/happy birthday/i);
  expect(titleElement).toBeInTheDocument();
});
