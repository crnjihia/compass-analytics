// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom';
import { expect, test } from 'vitest';
import { render } from '@testing-library/react';
import Sparkline from '../Sparkline';

test('renders sparkline with data', () => {
  const { container } = render(
    <Sparkline data={[10, 8, 6, 4, 2, 0, 0]} width={70} height={15} />
  );
  expect(container.querySelector('svg')).toBeInTheDocument();
});
